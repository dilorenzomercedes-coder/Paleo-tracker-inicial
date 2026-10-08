/**
 * FotoStore — fotos de la app de campo guardadas en IndexedDB (no en localStorage).
 *
 * localStorage tiene ~5-10 MB y se llenaba con ~50 puntos con foto. IndexedDB permite
 * cientos de MB (depende del espacio libre del celular).
 *
 * Cómo funciona:
 *  - Al sacar una foto, la imagen se guarda en IndexedDB y en el registro (localStorage)
 *    queda solo una referencia corta: "idb:photo_123_abc".
 *  - Para MOSTRARLA: fotoStore.src(valor) en el atributo src de un <img>. Un observador
 *    detecta esas imágenes y les carga la foto real automáticamente.
 *  - Para SINCRONIZAR / EXPORTAR: fotoStore.aDataURL(valor) devuelve la imagen en base64.
 *    NUNCA se manda la referencia al servidor (ese fue el error de Chos Malal).
 *  - Si algo falla al guardar en IndexedDB, la foto queda en base64 como antes: nunca se pierde.
 *
 * También entiende las referencias viejas "photo_..." (sin prefijo) de la versión anterior:
 * si ese celular todavía tiene la foto guardada, se recupera.
 */
const FOTO_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

class FotoStore {
    constructor() {
        this.DB_NAME = 'PaleoPhotoDB';
        this.STORE = 'photos';
        this.PREFIJO = 'idb:';
        this._urls = new Map();
        this.ready = this._abrir().catch(err => {
            console.error('FotoStore: no se pudo abrir IndexedDB', err);
            return null;
        });
        this._pedirPersistencia();
    }

    _abrir() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) return reject(new Error('IndexedDB no disponible'));
            const req = indexedDB.open(this.DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.STORE)) {
                    db.createObjectStore(this.STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // Pide al navegador que no borre estas fotos si el celular se queda sin espacio
    async _pedirPersistencia() {
        try {
            if (navigator.storage && navigator.storage.persist) {
                const ya = await navigator.storage.persisted();
                const ok = ya || await navigator.storage.persist();
                console.log('FotoStore: almacenamiento persistente =', ok);
            }
        } catch (e) { /* no soportado */ }
    }

    // ¿El valor es una referencia a IndexedDB (nueva "idb:..." o vieja "photo_...")?
    esRef(v) {
        return typeof v === 'string' && (v.startsWith(this.PREFIJO) || v.startsWith('photo_'));
    }

    // ¿Es una foto utilizable (base64, link o referencia)?
    esFotoValida(v) {
        return typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http') || this.esRef(v));
    }

    _id(ref) {
        return ref.startsWith(this.PREFIJO) ? ref.slice(this.PREFIJO.length) : ref;
    }

    static dataURLaBlob(dataURL) {
        try {
            const [header, b64] = dataURL.split(',');
            const mime = (header.match(/data:(.*?);base64/) || [])[1] || 'image/jpeg';
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new Blob([bytes], { type: mime });
        } catch (e) {
            console.error('FotoStore: data URL inválida', e);
            return null;
        }
    }

    static blobADataURL(blob) {
        return new Promise((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = () => resolve(null);
            r.readAsDataURL(blob);
        });
    }

    /**
     * Guarda una foto (data URL o Blob) y devuelve la referencia "idb:...".
     * Si no se puede guardar, devuelve el valor original (la foto sigue en base64).
     */
    async guardar(valor) {
        if (!valor || this.esRef(valor)) return valor;
        if (typeof valor === 'string' && !valor.startsWith('data:image')) return valor;
        try {
            const db = await this.ready;
            if (!db) return valor;
            const blob = typeof valor === 'string' ? FotoStore.dataURLaBlob(valor) : valor;
            if (!blob) return valor;
            const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await new Promise((resolve, reject) => {
                const tx = db.transaction(this.STORE, 'readwrite');
                tx.objectStore(this.STORE).put({ id, blob, creada: Date.now() });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error('Transacción abortada'));
            });
            return this.PREFIJO + id;
        } catch (err) {
            console.error('FotoStore: no se pudo guardar la foto, queda en base64', err);
            return valor;
        }
    }

    async _leer(ref) {
        const db = await this.ready;
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(this.STORE, 'readonly');
                const req = tx.objectStore(this.STORE).get(this._id(ref));
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    }

    async obtenerBlob(ref) {
        const r = await this._leer(ref);
        if (!r) return null;
        if (r.blob) return r.blob;
        if (typeof r.data === 'string') return FotoStore.dataURLaBlob(r.data); // formato viejo
        return null;
    }

    /** Devuelve la foto en base64 (para sincronizar o exportar). null si no está en este celular. */
    async aDataURL(valor) {
        if (!valor || typeof valor !== 'string') return null;
        if (!this.esRef(valor)) return valor;
        const blob = await this.obtenerBlob(valor);
        return blob ? FotoStore.blobADataURL(blob) : null;
    }

    async urlParaMostrar(ref) {
        if (this._urls.has(ref)) return this._urls.get(ref);
        const blob = await this.obtenerBlob(ref);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        this._urls.set(ref, url);
        return url;
    }

    async borrar(ref) {
        if (!this.esRef(ref)) return;
        try {
            const db = await this.ready;
            if (!db) return;
            await new Promise((resolve) => {
                const tx = db.transaction(this.STORE, 'readwrite');
                tx.objectStore(this.STORE).delete(this._id(ref));
                tx.oncomplete = () => resolve();
                tx.onerror = () => resolve();
            });
            if (this._urls.has(ref)) {
                URL.revokeObjectURL(this._urls.get(ref));
                this._urls.delete(ref);
            }
        } catch (e) { /* silencioso */ }
    }

    /**
     * Para usar DENTRO de src="..." en un template:  <img src="${fotoStore.src(valor)}">
     * Si es una referencia, pone una imagen vacía y marca el <img> para cargarle la foto real.
     */
    src(valor) {
        if (this.esRef(valor)) return `${FOTO_PLACEHOLDER}" data-foto-ref="${valor}`;
        return valor || '';
    }

    _hidratar(img) {
        const ref = img.getAttribute('data-foto-ref');
        if (!ref || img.dataset.fotoCargada === ref) return;
        img.dataset.fotoCargada = ref;
        this.urlParaMostrar(ref).then(url => {
            if (url) {
                img.src = url;
            } else {
                img.alt = 'Foto no disponible en este celular';
                img.style.background = '#eee';
            }
        });
    }

    _hidratarEn(nodo) {
        if (!nodo || nodo.nodeType !== 1) return;
        if (nodo.matches && nodo.matches('img[data-foto-ref]')) this._hidratar(nodo);
        if (nodo.querySelectorAll) nodo.querySelectorAll('img[data-foto-ref]').forEach(img => this._hidratar(img));
    }

    // Observa la página: cualquier <img data-foto-ref> que aparezca (listas, detalle, mapa) se carga sola
    observar() {
        if (this._observador) return;
        this._hidratarEn(document.body);
        this._observador = new MutationObserver(mutaciones => {
            for (const m of mutaciones) {
                if (m.type === 'attributes') this._hidratarEn(m.target);
                m.addedNodes && m.addedNodes.forEach(n => this._hidratarEn(n));
            }
        });
        this._observador.observe(document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['data-foto-ref']
        });
    }

    async cantidadFotos() {
        const db = await this.ready;
        if (!db) return 0;
        return new Promise((resolve) => {
            const req = db.transaction(this.STORE, 'readonly').objectStore(this.STORE).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(0);
        });
    }
}

window.fotoStore = new FotoStore();
window.photoStore = window.fotoStore; // compatibilidad con código viejo

if (document.body) {
    window.fotoStore.observar();
} else {
    document.addEventListener('DOMContentLoaded', () => window.fotoStore.observar());
}
