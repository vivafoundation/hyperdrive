module.exports = class FileDescriptor {
  constructor (contentFeed, path, stat) {
    this.stat = stat
    this.path = path
    this.position = null
    this.blockPosition = stat.offset
    this.blockOffset = 0
    this.contentFeed = contentFeed
  }

  read (buffer, offset, len, pos, cb) {
    if (this.position === pos) this._read(buffer, offset, len, cb)
    else this._seekAndRead(buffer, offset, len, pos, cb)
  }

  write (buffer, offset, len, pos, cb) {
    // TODO: implement
  }

  close () {
    // TODO: undownload initial range
  }

  _seekAndRead (buffer, offset, len, pos, cb) {
    const start = this.stat.offset
    const end = start + this.stat.blocks

    this.contentFeed.seek(this.stat.byteOffset + pos, { start, end }, (err, blk, blockOffset) => {
      if (err) return cb(err)
      this.position = pos
      this.blockPosition = blk
      this.blockOffset = blockOffset
      this._read(buffer, offset, len, cb)
    })
  }

  _read (buffer, offset, len, cb) {
    const buf = buffer.slice(offset, offset + len)
    const blkOffset = this.blockOffset
    const blk = this.blockPosition

    if ((this.stat.offset + this.stat.blocks) <= blk || blk < this.stat.offset) {
      return process.nextTick(cb, null, 0, buffer)
    }

    this.contentFeed.get(blk, (err, data) => {
      if (err) return cb(err)
      if (blkOffset) data = data.slice(blkOffset)

      data.copy(buf)
      const read = Math.min(data.length, buf.length)

      if (blk === this.blockPosition && blkOffset === this.blockOffset) {
        this.position += read
        if (read === data.length) {
          this.blockPosition++
          this.blockOffset = 0
        } else {
          this.blockOffset = blkOffset + read
        }
      }

      cb(null, read, buffer)
    })
  }
}