const through = require('through2')
const request = require('request')
const Vinyl = require('vinyl')
const { postSlackMessage } = require('../util')

/**
 * Download external data (gtfs, osm) resources.
 */
module.exports = function (entries) {
  let downloadCount = 0

  var stream = through.obj()

  const incProcessed = () => {
    downloadCount += 1
    if (downloadCount !== entries.length) {
      downloadIgnoreErrors(entries[downloadCount])
    } else {
      stream.end()
    }
  }

  const downloadIgnoreErrors = (entry) => {
    const downloadHandler = (err, res, body) => {
      if (err) {
        postSlackMessage(`${entry.url} Download failed: ${err}. Using previous data instead.`)
        process.stdout.write(entry.url + ' Download FAILED\n')
        incProcessed()
        return
      }
      const name = entry.url.split('/').pop()
      var fileExt = name.split('.').pop() !== name ? name.split('.').pop() : 'zip' // if the provided file name does not contain any extension assume that the right one is .zip
      const remoteHash = res.headers['content-md5']
      const file = new Vinyl({ path: `${entry.id !== undefined ? (entry.id + '.' + fileExt) : name}`, contents: Buffer.from(body), hash: remoteHash })
      stream.push(file)

      process.stdout.write(entry.url + ' Download SUCCESS\n')
      incProcessed()
    }

    process.stdout.write('Downloading ' + entry.url + '...\n')
    request({ url: entry.url, encoding: null }, downloadHandler)
  }
  downloadIgnoreErrors(entries[0])

  return stream
}
