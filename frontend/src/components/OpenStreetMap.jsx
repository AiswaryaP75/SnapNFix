import { useEffect, useRef } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Style, Icon } from 'ol/style'
import Overlay from 'ol/Overlay'
import { defaults as defaultControls, Zoom } from 'ol/control'
import 'ol/ol.css'

const statusColors = {
  blue: '#2563eb',
  purple: '#7c3aed',
  amber: '#d97706',
  orange: '#ea580c',
  emerald: '#059669',
}

function createPinSvg(colorHex = '#2563eb', isSelected = false) {
  const width = isSelected ? 34 : 28
  const height = isSelected ? 46 : 38
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 30 40">
      <defs>
        <filter id="shadow" x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.38"/>
        </filter>
      </defs>
      <path d="M15 1 C7 1 1 7 1 15 C1 26 15 39 15 39 C15 39 29 26 29 15 C29 7 23 1 15 1 Z" fill="${colorHex}" stroke="#ffffff" stroke-width="${isSelected ? '2.5' : '1.5'}" filter="url(#shadow)"/>
      <circle cx="15" cy="14" r="5" fill="#ffffff"/>
    </svg>
  `
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim())
}

export function OpenStreetMap({
  issues = [],
  center = [40.735, -74.000],
  zoom = 14,
  selectedIssue = null,
  onSelectIssue,
  recenterTrigger = 0,
}) {
  const mapContainerRef = useRef(null)
  const tooltipRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const vectorSourceRef = useRef(null)
  const overlayRef = useRef(null)
  const onSelectRef = useRef(onSelectIssue)

  useEffect(() => {
    onSelectRef.current = onSelectIssue
  }, [onSelectIssue])

  // Initialize OpenLayers Map once
  useEffect(() => {
    if (!mapContainerRef.current) return

    const vectorSource = new VectorSource()
    vectorSourceRef.current = vectorSource

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      zIndex: 10,
    })

    const tileLayer = new TileLayer({
      source: new OSM({
        attributions: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }),
    })

    const initialCenter = fromLonLat([center[1], center[0]])

    const map = new Map({
      target: mapContainerRef.current,
      layers: [tileLayer, vectorLayer],
      view: new View({
        center: initialCenter,
        zoom: zoom,
        maxZoom: 19,
        minZoom: 3,
      }),
      controls: defaultControls({ zoom: false }).extend([
        new Zoom({ className: 'osm-zoom-control' }),
      ]),
    })

    // Setup tooltip overlay
    if (tooltipRef.current) {
      const overlay = new Overlay({
        element: tooltipRef.current,
        offset: [0, -36],
        positioning: 'bottom-center',
        stopEvent: false,
      })
      map.addOverlay(overlay)
      overlayRef.current = overlay
    }

    // Pointer hover interaction
    map.on('pointermove', (event) => {
      if (event.dragging) return
      const pixel = map.getEventPixel(event.originalEvent)
      const hit = map.hasFeatureAtPixel(pixel)
      map.getTargetElement().style.cursor = hit ? 'pointer' : ''

      if (hit && overlayRef.current && tooltipRef.current) {
        const feature = map.forEachFeatureAtPixel(pixel, (f) => f)
        if (feature) {
          const issue = feature.get('issue')
          if (issue) {
            tooltipRef.current.innerHTML = `
              <div class="osm-tooltip-inner">
                <div class="osm-tooltip-header">
                  <span class="osm-tooltip-badge badge-${issue.color}">${issue.status}</span>
                  <span class="osm-tooltip-id">${issue.id}</span>
                </div>
                <div class="osm-tooltip-title">${issue.title}</div>
                <div class="osm-tooltip-street">${issue.street}</div>
              </div>
            `
            overlayRef.current.setPosition(event.coordinate)
            tooltipRef.current.style.display = 'block'
            return
          }
        }
      }

      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'none'
      }
    })

    // Click on marker
    map.on('click', (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f)
      if (feature) {
        const issue = feature.get('issue')
        if (issue && onSelectRef.current) {
          onSelectRef.current(issue)
        }
      }
    })

    mapInstanceRef.current = map

    const timer = setTimeout(() => {
      map.updateSize()
    }, 100)

    return () => {
      clearTimeout(timer)
      map.setTarget(null)
      mapInstanceRef.current = null
    }
  }, [center, zoom])

  // Update markers when issues or selectedIssue change
  useEffect(() => {
    const vectorSource = vectorSourceRef.current
    if (!vectorSource) return

    vectorSource.clear()

    const validIssues = issues.filter(
      (i) => Number.isFinite(i.lat) && Number.isFinite(i.lng)
    )

    const features = validIssues.map((issue) => {
      const isSelected = selectedIssue?.id === issue.id || selectedIssue?.dbId === issue.dbId
      const colorHex = statusColors[issue.color] || '#2563eb'
      const iconUrl = createPinSvg(colorHex, isSelected)

      const feature = new Feature({
        geometry: new Point(fromLonLat([issue.lng, issue.lat])),
        issue,
      })

      feature.setStyle(
        new Style({
          image: new Icon({
            src: iconUrl,
            anchor: [0.5, 1],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
          }),
        })
      )

      return feature
    })

    vectorSource.addFeatures(features)
  }, [issues, selectedIssue])

  // Recenter map on recenterTrigger or issues load
  useEffect(() => {
    const map = mapInstanceRef.current
    const vectorSource = vectorSourceRef.current
    if (!map || !vectorSource) return

    const features = vectorSource.getFeatures()
    if (features.length > 0) {
      const extent = vectorSource.getExtent()
      map.getView().fit(extent, {
        padding: [60, 60, 60, 60],
        maxZoom: 16,
        duration: 500,
      })
    } else if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      map.getView().animate({
        center: fromLonLat([center[1], center[0]]),
        zoom: zoom,
        duration: 500,
      })
    }
  }, [recenterTrigger, center, zoom])

  // Center on selectedIssue if provided
  useEffect(() => {
    if (!selectedIssue || !mapInstanceRef.current) return
    if (Number.isFinite(selectedIssue.lat) && Number.isFinite(selectedIssue.lng)) {
      mapInstanceRef.current.getView().animate({
        center: fromLonLat([selectedIssue.lng, selectedIssue.lat]),
        zoom: Math.max(mapInstanceRef.current.getView().getZoom() || 14, 15),
        duration: 400,
      })
    }
  }, [selectedIssue])

  return (
    <div className="osm-map-wrapper">
      <div ref={mapContainerRef} className="osm-map-container" />
      <div ref={tooltipRef} className="osm-tooltip-popup" style={{ display: 'none' }} />
    </div>
  )
}

export function LocationPickerMap({
  selectedCoords,
  onPickCoords,
  center = [40.735, -74.000],
  zoom = 13,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const vectorSourceRef = useRef(null)
  const onPickRef = useRef(onPickCoords)

  useEffect(() => {
    onPickRef.current = onPickCoords
  }, [onPickCoords])

  useEffect(() => {
    if (!mapContainerRef.current) return

    const vectorSource = new VectorSource()
    vectorSourceRef.current = vectorSource

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      zIndex: 10,
    })

    const tileLayer = new TileLayer({
      source: new OSM(),
    })

    const initialCenter = selectedCoords
      ? fromLonLat([selectedCoords.lng, selectedCoords.lat])
      : fromLonLat([center[1], center[0]])

    const map = new Map({
      target: mapContainerRef.current,
      layers: [tileLayer, vectorLayer],
      view: new View({
        center: initialCenter,
        zoom: zoom,
        maxZoom: 19,
        minZoom: 3,
      }),
      controls: defaultControls({ zoom: false }).extend([
        new Zoom({ className: 'osm-zoom-control' }),
      ]),
    })

    map.on('click', (event) => {
      const coords = toLonLat(event.coordinate)
      const lat = Number(coords[1].toFixed(6))
      const lng = Number(coords[0].toFixed(6))
      if (onPickRef.current) {
        onPickRef.current({ lat, lng })
      }
    })

    mapInstanceRef.current = map

    const timer = setTimeout(() => map.updateSize(), 100)

    return () => {
      clearTimeout(timer)
      map.setTarget(null)
      mapInstanceRef.current = null
    }
  }, [center, zoom, selectedCoords])

  useEffect(() => {
    const vectorSource = vectorSourceRef.current
    const map = mapInstanceRef.current
    if (!vectorSource) return

    vectorSource.clear()

    if (selectedCoords && Number.isFinite(selectedCoords.lat) && Number.isFinite(selectedCoords.lng)) {
      const pinUrl = createPinSvg('#2563eb', true)
      const feature = new Feature({
        geometry: new Point(fromLonLat([selectedCoords.lng, selectedCoords.lat])),
      })
      feature.setStyle(
        new Style({
          image: new Icon({
            src: pinUrl,
            anchor: [0.5, 1],
            anchorXUnits: 'fraction',
            anchorYUnits: 'fraction',
          }),
        })
      )
      vectorSource.addFeature(feature)

      if (map) {
        map.getView().animate({
          center: fromLonLat([selectedCoords.lng, selectedCoords.lat]),
          duration: 300,
        })
      }
    }
  }, [selectedCoords])

  return (
    <div className="osm-picker-map-wrapper">
      <div ref={mapContainerRef} className="osm-picker-container" />
      <div className="osm-picker-hint">Click anywhere on OpenStreetMap to place the report pin</div>
    </div>
  )
}
