const JSZip = require('jszip')
const fs = require('fs')
const converter = require('json-2-csv')
const through = require('through2')
const cloneable = require('cloneable-readable')

function createFeedInfo (zip, file, csv, cb) {
  zip.file('feed_info.txt', csv)
  zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE' })
    .pipe(fs.createWriteStream(file))
    .on('finish', function () {
      cb(null)
    })
}

function setFeedId (file, id, cb) {
  fs.readFile(file, function (err, data) {
    if (err) cb(err)
    const zip = new JSZip()
    zip.loadAsync(data).then(function () {
      const feedInfo = zip.file('feed-info.txt')
      if (feedInfo === null) {
        const csv = `feed_publisher_name,feed_publisher_url,feed_lang,feed_id
${id}-fake-name,${id}-fake-url,${id}-fake-lang,${id}\n`

        createFeedInfo(zip, file, csv, () => {
          cb('created') // eslint-disable-line
        })
      } else {
        // callback function for csv2json converter
        const csv2jsonCallback = function (err, json) {
          if (err) {
            cb(err)
            return
          }

          // callback function for json2csv converter
          /* eslint-disable */
          const json2csvcallback = function (err, csv) {
            createFeedInfo(zip, file, csv, () => {
              cb('edited')
            })
          }
          /* eslint-enable */
          if (json.length > 0) {
            // no id or id is wrong
            if (json[0]['feed_id'] === undefined || json[0]['feed_id'] !== id) {
              json[0]['feed_id'] = id
              converter.json2csv(json, json2csvcallback)
            } else {
              // id was already ok
              cb('nop') // eslint-disable-line
            }
          }
        }

        feedInfo.async('string').then(function (data) {
          converter.csv2json(data, csv2jsonCallback)
        })
      }
    })
  })
}

module.exports = {
  /**
   * Sets gtfs feed id in gtfs zip
   */
  setFeedIdTask: () => {
    return through.obj(function (file, encoding, callback) {
      const gtfsFile = file.history[file.history.length - 1]
      const fileName = gtfsFile.split('/').pop()
      const id = fileName.substring(0, fileName.indexOf('.'))
      process.stdout.write(gtfsFile + ' ' + 'Setting GTFS feed id to ' + id + '\n')
      setFeedId(gtfsFile, id, (action) => {
        process.stdout.write(gtfsFile + ' ID ' + action + ' SUCCESS\n')
        file.contents = cloneable(fs.createReadStream(gtfsFile))
        callback(null, file)
      })
    })
  }
}
