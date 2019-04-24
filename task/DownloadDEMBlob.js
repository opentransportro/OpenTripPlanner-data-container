const crypto = require('crypto')
const fs = require('fs')
const request = require('request')

const { dataDir } = require('../config')

/**
 * Compare Content-MD5 header md5 hash value to hash value calculated from local a copy of the file.
 */
const compareHashes = (headerHash, localFilePath) => {
  return new Promise((resolve, reject) => {
    let shasum = crypto.createHash('md5')
    let s = fs.ReadStream(localFilePath)
    // Download file as it's not found locally
    s.on('error', function (err) {
      process.stdout.write(err)
      reject('error') // eslint-disable-line
    })
    s.on('data', function (data) {
      shasum.update(data)
    })
    s.on('end', function () {
      var fileHash = shasum.digest('base64')
      if (fileHash === headerHash) {
        resolve(true)
      } else {
        reject('end') // eslint-disable-line
      }
    })
  })
}

/**
 * Download DEM files from Azure blob storage.
 */
module.exports = function (entries) {
  return entries.map((entry) => {
    return new Promise((resolve, reject) => {
      const filePath = `${dataDir}/downloads/dem/${entry.id}.tif`
      const readyPath = `${dataDir}/ready/dem/${entry.id}.tif`
      let dataAlreadyExists = false
      let downloadHash
      const r = request(entry.url)

      const stream = r.pipe(fs.createWriteStream(filePath))
      r.on('response', response => {
        if (response.statusCode === 200) {
          downloadHash = response.headers['content-md5']
          compareHashes(downloadHash, readyPath)
            .then((resolved) => {
              if (resolved) {
                process.stdout.write(`Local DEM data for ${entry.id} was already up-to-date\n`)
                dataAlreadyExists = true
                // Abort download as remote has same md5 as local copy
                r.abort()
              }
            }).catch((err) => {
              if (err === 'end') {
                process.stdout.write(`${entry.url} hash value differs from local file's hash value\n`)
                process.stdout.write(`Downloading new DEM data from ${entry.url}\n`)
              } else if (err === 'error') {
                process.stdout.write(`Failed to load local DEM data for ${entry.id}\n`)
                process.stdout.write(`Downloading new DEM data from ${entry.url}\n`)
              } else {
                process.stdout.write(err)
                process.stdout.write(`Failed to load local DEM data for ${entry.id}\n`)
                process.stdout.write(`Downloading new DEM data from ${entry.url}\n`)
              }
            })
        }
      })
      r.on('error', err => {
        process.stdout.write(err)
        process.stdout.write(`Failed to load new DEM data for ${entry.id}\n`)
        reject('fail') // eslint-disable-line
      })
      stream.on('finish', () => {
        // If new file was downloaded, this resolves with the file's path
        // This is also called when request is aborted but new call to resolve shouldn't do anything
        // However, if the file is really small, this could in theory be called before call to abort request
        // but that situation shouldn't happen with DEM data sizes.
        if (!dataAlreadyExists) {
          compareHashes(downloadHash, filePath)
            .then((resolved) => {
              if (resolved) {
                process.stdout.write(`Downloaded updated DEM data to ${filePath}\n`)
                fs.rename(filePath, readyPath, (err) => {
                  if (err) {
                    if (fs.existsSync(filePath)) {
                      fs.unlinkSync(filePath)
                    }
                    process.stdout.write(err)
                    process.stdout.write(`Failed to move DEM data from ${readyPath}\n`)
                    reject('fail') // eslint-disable-line
                  } else {
                    process.stdout.write(
                      `DEM data update process was successful for ${entry.id}\n`
                    )
                    resolve()
                  }
                })
              }
            }).catch((err) => {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
              }
              if (err === 'end') {
                process.stdout.write(`${entry.url} hash value differs from just downloaded file's hash value\n`)
              } else if (err === 'error') {
                process.stdout.write(`Failed to load local DEM data for ${entry.id}\n`)
              } else {
                process.stdout.write(err)
              }
              reject('fail') // eslint-disable-line
            })
        } else {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
          resolve()
        }
      })
    })
  })
}
