
/*
 * id = feedid (String)
 * url = feed url (String)
 * fit = mapfit shapes (true/false)
 * rules = OBA Filter rules to apply (array of strings)
 */
const src = (id, url, fit, rules) => ({ id, url, fit, rules })

const ROMANIA_CONFIG = {
  'id': 'romania',
  'src': [
    src('timisoara', 'https://github.com/opentransportro/timisoara-gtfs-exporter/releases/download/latest/gtfs-timisoara.zip', false),
    src('sibiu', 'https://github.com/opentransportro/sibiu-gtfs-exporter/releases/download/latest/gtfs-sibiu.zip', false),
    src('bucharest', 'https://github.com/opentransportro/bucharest-gtfs-exporter/releases/download/latest/gtfs-bucharest.zip', false),
    src('iasi', 'https://github.com/opentransportro/iasi-gtfs-exporter/releases/download/latest/gtfs-iasi.zip', false),
    src('iasi', 'https://github.com/opentransportro/constanta-gtfs-exporter/releases/download/latest/gtfs-constanta.zip', false),
    src('cfr', 'https://github.com/opentransportro/cfr-gtfs-exporter/releases/download/latest/cfr.zip', false)
  ],
  'osm': 'romania'
  // 'dem': 'romania'
}

let ALL_CONFIGS

const setCurrentConfig = (name) => {
  ALL_CONFIGS = [
    ROMANIA_CONFIG
  ].reduce((acc, nxt) => {
    if ((name && name.split(',').indexOf(nxt.id) !== -1) ||
      name === undefined) {
      acc.push(nxt)
    }
    return acc
  }, [])
}

// Allow limiting active configs with env variable
if (process.env.ROUTERS) {
  setCurrentConfig(process.env.ROUTERS.replace(/ /g, ''))
} else {
  setCurrentConfig()
}

// EXTRA_SRC format should be {"FOLI": {"url": "http://data.foli.fi/gtfs/gtfs.zip",  "fit": false, "rules": ["router-waltti/gtfs-rules/waltti.rule"], "routers": ["hsl", "finland"]}}
// but you can only define, for example, new url and the other key value pairs will remain the same as they are defined in this file. "routers" is always a mandatory field.
// It is also possible to add completely new src by defining object with unused id or to remove a src by defining "remove": true
const extraSrc = process.env.EXTRA_SRC !== undefined ? JSON.parse(process.env.EXTRA_SRC) : {}

let usedSrc = []
// add config to every source and override config values if they are defined in extraSrc
for (let i = 0; i < ALL_CONFIGS.length; i++) {
  const cfg = ALL_CONFIGS[i]
  const cfgSrc = cfg.src
  for (let j = cfgSrc.length - 1; j >= 0; j--) {
    const src = cfgSrc[j]
    const id = src.id
    if (extraSrc[id] && extraSrc[id].routers !== undefined && extraSrc[id].routers.includes(cfg.id)) {
      usedSrc.push(id)
      if (extraSrc[id].remove) {
        cfgSrc.splice(j, 1)
        continue
      }
      cfgSrc[j] = { ...src, ...extraSrc[src.id] }
    }
    cfgSrc[j].config = cfg
  }
}

// Go through extraSrc keys to find keys that don't already exist in src and add those as new src
Object.keys(extraSrc).forEach((id) => {
  if (!usedSrc.includes(id)) {
    const routers = extraSrc[id].routers
    for (let i = 0; i < ALL_CONFIGS.length; i++) {
      const cfg = ALL_CONFIGS[i]
      if (routers === undefined || routers.includes(cfg.id)) {
        cfg.src.push({ ...extraSrc[id], id })
      }
    }
  }
})

// create id->src-entry map
const configMap = ALL_CONFIGS.map(cfg => cfg.src)
  .reduce((acc, val) => acc.concat(val), [])
  .reduce((acc, val) => {
    if (acc[val.id] === undefined) {
      acc[val.id] = val
    }
    return acc
  }, {})

const osm = [
  { id: 'romania', url: 'https://download.geofabrik.de/europe/romania-latest.osm.pbf' }
]

const dem = [
]

const constants = {
  BUFFER_SIZE: 1024 * 1024 * 32
}

module.exports = {
  ALL_CONFIGS: () => ALL_CONFIGS,
  configMap,
  osm,
  osmMap: osm.reduce((acc, val) => { acc[val.id] = val; return acc }, {}),
  dem,
  demMap: dem.reduce((acc, val) => { acc[val.id] = val; return acc }, {}),
  dataToolImage: `opentransport/otp-data-tools:${process.env.TOOLS_TAG || 'latest'}`,
  dataDir: process.env.DATA || `${process.cwd()}/data`,
  hostDataDir: process.env.HOST_DATA || `${process.cwd()}/data`,
  setCurrentConfig: setCurrentConfig,
  constants
}
