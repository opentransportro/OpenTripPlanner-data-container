const exec = require('child_process').exec
const fs = require('fs')
const { dataToolImage, hostDataDir, constants } = require('../config.js')

/**
 * remove column from stop_times.txt
 */
module.exports = function () {
  if (!fs.existsSync(`${hostDataDir}/data/fit/gtfs/HSL.zip`)) {
    return Promise.resolve(true)
  }
  const p = new Promise((resolve, reject) => {
    const lastLog = []
    const cmd = `set +e
    cd /data/fit
  unzip -o gtfs/HSL.zip stop_times.txt
  # TODO: Check that the line is in expected format
  # Needed in order to get rid of 'shape_distance_travelled'
  # this field is not currently available in shapes.txt. OpenTripPlanner needs it to be.
  cut --complement -f 9 -d, stop_times.txt > stop_times.new
  mv stop_times.new stop_times.txt
  zip -f gtfs/HSL.zip stop_times.txt
  rm stop_times.txt`
    const fullCommand = `docker pull ${dataToolImage}; docker run --rm -v ${hostDataDir}:/data ${dataToolImage} bash -c "${cmd}"`
    const hslHack = exec(fullCommand, { maxBuffer: constants.BUFFER_SIZE })

    hslHack.on('exit', function (c) {
      if (c === 0) {
        process.stdout.write('HSL Hack SUCCESS\n')
        resolve()
      } else {
        const e = lastLog.join('')
        reject(e)
        process.stdout.write(`HSL Hack FAILED (${c})\n${e}\n`)
      }
    })

    hslHack.stdout.on('data', function (data) {
      lastLog.push(data.toString())
      if (lastLog.length > 20) {
        lastLog.splice(0, 1)
      }
    })
  })
  return p
}
