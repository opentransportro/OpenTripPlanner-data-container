const gulp = require('gulp')
const { setCurrentConfig } = require('./config')
require('./gulpfile')
const { promisify } = require('util')
const everySeries = require('async/everySeries')
const { execFileSync } = require('child_process')
const { postSlackMessage } = require('./util')

const every = promisify((list, task, cb) => {
  everySeries(list, task, function (err, result) {
    cb(err, result)
  })
})

const start = promisify((task, cb) => gulp.series(task)(cb))

const updateDEM = ['dem:update']
const updateOSM = ['osm:update']
const updateGTFS = ['gtfs:dl', 'gtfs:fit', 'gtfs:filter', 'gtfs:id']

let routers
if (process.env.ROUTERS) {
  routers = process.env.ROUTERS.replace(/ /g, '').split(',')
} else {
  routers = ['romania']
}

async function update () {
  postSlackMessage('Starting data build')
  setCurrentConfig(routers.join(',')) // restore used config

  await every(updateDEM, function (task, callback) {
    start(task).then(() => { callback(null, true) })
  })

  await every(updateOSM, function (task, callback) {
    start(task).then(() => { callback(null, true) })
  })

  await every(updateGTFS, function (task, callback) {
    start(task).then(() => { callback(null, true) })
  })

  await every(routers, function (router, callback) {
    setCurrentConfig(router)
    start('router:buildGraph').then(() => {
      try {
        process.stdout.write('Executing deploy script.\n')
        execFileSync('./deploy.sh', [router],
          {
            env:
              {
                DOCKER_USER: process.env.DOCKER_USER,
                DOCKER_AUTH: process.env.DOCKER_AUTH,
                DOCKER_TAG: process.env.DOCKER_TAG,
                TEST_TAG: process.env.OTP_TAG || '',
                TOOLS_TAG: process.env.TOOLS_TAG || '',
                DOCKER_API_VERSION: process.env.DOCKER_API_VERSION
              },
            stdio: [0, 1, 2]
          }
        )
        postSlackMessage(`${router} data updated.`)
      } catch (E) {
        postSlackMessage(`${router} data update failed: ` + E.message)
      }
      callback(null, true)
    })
  })
}

// entry point for script
update();