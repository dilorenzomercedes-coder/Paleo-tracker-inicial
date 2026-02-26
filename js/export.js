class Exporter {
  static generateKML(data) {
    const { hallazgos, fragmentos, routes } = data;

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Paleo Heritage Export</name>
    <Style id="hallazgoStyle">
      <IconStyle>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="fragmentoStyle">
      <IconStyle>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="routeStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>5</width>
      </LineStyle>
    </Style>`;

    // Group by Folder
    const itemsByFolder = {};

    // Helper to add to folder map
    const addToFolder = (folderName, content) => {
      const name = folderName || 'Sin Carpeta';
      if (!itemsByFolder[name]) itemsByFolder[name] = [];
      itemsByFolder[name].push(content);
    };

    // Process Hallazgos
    hallazgos.forEach(h => {
      if (h.lat && h.lng) {
        // Build photos HTML - support up to 3 photos
        let photosHtml = '';
        if (h.foto1) photosHtml += `<br><img src="${h.foto1}" width="300" /><br>`;
        if (h.foto2) photosHtml += `<br><img src="${h.foto2}" width="300" /><br>`;
        if (h.foto3) photosHtml += `<br><img src="${h.foto3}" width="300" /><br>`;
        // Fallback for old data with single 'foto' field
        if (!photosHtml && h.foto) photosHtml = `<br><img src="${h.foto}" width="300" /><br>`;

        const desc = `
                    <b>Código:</b> ${h.codigo || ''}<br>
                    <b>Material:</b> ${h.tipo_material}<br>
                    <b>Taxonomía:</b> ${h.taxonomia || ''}<br>
                    <b>Fecha:</b> ${h.fecha}<br>
                    <b>Colector:</b> ${h.colector}<br>
                    <b>Localidad:</b> ${h.localidad || ''}<br>
                    ${photosHtml}
                `;
        const placemark = `
      <Placemark>
        <name>${h.codigo || 'Hallazgo'} - ${h.tipo_material}</name>
        <description><![CDATA[${desc}]]></description>
        <styleUrl>#hallazgoStyle</styleUrl>
        <Point>
          <coordinates>${h.lng},${h.lat}</coordinates>
        </Point>
      </Placemark>`;
        addToFolder(h.folder, placemark);
      }
    });

    // Process Fragmentos
    fragmentos.forEach(a => {
      if (a.lat && a.lng) {
        const desc = `
                    <b>Fecha:</b> ${a.fecha}<br>
                    <b>Localidad:</b> ${a.localidad}<br>
                    ${a.foto ? `<br><img src="${a.foto}" width="300" /><br>` : ''}
                `;
        const placemark = `
      <Placemark>
        <name>Fragmento - ${a.localidad}</name>
        <description><![CDATA[${desc}]]></description>
        <styleUrl>#fragmentoStyle</styleUrl>
        <Point>
          <coordinates>${a.lng},${a.lat}</coordinates>
        </Point>
      </Placemark>`;
        addToFolder(a.folder, placemark);
      }
    });

    // Generate Folder XML
    Object.keys(itemsByFolder).sort().forEach(folderName => {
      kml += `
    <Folder>
      <name>${folderName}</name>
      ${itemsByFolder[folderName].join('')}
    </Folder>`;
    });

    // Add Routes (Separate Folder)
    if (routes.length > 0) {
      kml += `
    <Folder>
      <name>Caminos Importados</name>`;

      routes.forEach(r => {
        const routeName = r.name || 'Ruta sin nombre';
        const geometries = this._extractGeometries(r.content);

        if (geometries.length > 0) {
          kml += `
      <Placemark>
        <name>${routeName}</name>
        <description>Ruta importada el ${new Date(r.timestamp).toLocaleDateString()}</description>
        <styleUrl>#routeStyle</styleUrl>
        <MultiGeometry>
          ${geometries.join('\n')}
        </MultiGeometry>
      </Placemark>`;
        } else {
          // Fallback if no geometry found
          kml += `
      <Placemark>
        <name>${routeName} (Sin geometría)</name>
        <description>No se pudieron extraer coordenadas.</description>
      </Placemark>`;
        }
      });

      kml += `
    </Folder>`;
    }

    kml += `
  </Document>
</kml>`;

    return kml;
  }

  static _extractGeometries(kmlContent) {
    if (!kmlContent) return [];

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlContent, "text/xml");
      const geometries = [];

      // Extract LineStrings
      const lineStrings = xmlDoc.getElementsByTagName("LineString");
      for (let i = 0; i < lineStrings.length; i++) {
        const coords = lineStrings[i].getElementsByTagName("coordinates")[0];
        if (coords) {
          geometries.push(`<LineString><coordinates>${coords.textContent}</coordinates></LineString>`);
        }
      }

      // Extract Points (if any, though usually we want lines for routes)
      // Optional: Include points if they are part of the route file
      /*
      const points = xmlDoc.getElementsByTagName("Point");
      for (let i = 0; i < points.length; i++) {
          const coords = points[i].getElementsByTagName("coordinates")[0];
          if (coords) {
              geometries.push(`<Point><coordinates>${coords.textContent}</coordinates></Point>`);
          }
      }
      */

      // Fallback: search for any coordinates tag if no LineString found
      if (geometries.length === 0) {
        const allCoords = xmlDoc.getElementsByTagName("coordinates");
        for (let i = 0; i < allCoords.length; i++) {
          // Heuristic: if it has many coords, it's likely a line
          const text = allCoords[i].textContent.trim();
          if (text.split(/\s+/).length > 1) {
            geometries.push(`<LineString><coordinates>${text}</coordinates></LineString>`);
          }
        }
      }

      return geometries;
    } catch (e) {
      console.error("Error parsing KML content for export", e);
      return [];
    }
  }

  static async download(filename, text) {
    // Check if running in Capacitor (native app)
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        // Use Capacitor plugins from global scope
        const Filesystem = window.Capacitor.Plugins.Filesystem;
        const Share = window.Capacitor.Plugins.Share;

        if (!Filesystem || !Share) {
          throw new Error('Plugins de Capacitor no disponibles');
        }

        // Write file to cache directory
        const result = await Filesystem.writeFile({
          path: filename,
          data: text,
          directory: 'CACHE',
          encoding: 'utf8'
        });

        // Share the file so user can save it wherever they want
        await Share.share({
          title: 'Exportar KML',
          text: 'Archivo KML de Paleo Heritage',
          url: result.uri,
          dialogTitle: 'Guardar archivo KML'
        });

        return true;
      } catch (error) {
        console.error('Error saving file on native:', error);
        // Fallback to alert
        alert('Error al guardar el archivo: ' + error.message);
        return false;
      }
    } else {
      // Web fallback - use data URL download
      const element = document.createElement('a');
      element.setAttribute('href', 'data:application/vnd.google-earth.kml+xml;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      return true;
    }
  }
}
