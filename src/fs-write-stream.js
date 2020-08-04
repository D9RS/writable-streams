'use strict';

const fs = require('fs');

const { Writable } = require('./writable');
const { InvalidArgTypeError, OutOfRangeError } = require('./errors');

const openFile = Symbol('open');
const closeFile = Symbol('close');

class WritableFileStream extends Writable {
    constructor(
        path,
        {
            fd = null,
            start = 0,
            flags = 'w',
            mode = 0o666,
            encoding: defaultEncoding = 'utf8',
            autoClose = true,
            emitClose = false,
        } = {}
    ) {
        super({ emitClose, defaultEncoding });

        if (typeof path !== 'string') {
            throw new InvalidArgTypeError('path', 'string', path);
        }

        if (typeof start !== 'number') {
            throw new InvalidArgTypeError('start', 'number', start);
        }

        if (start < 0 || start > Number.MAX_SAFE_INTEGER) {
            throw new OutOfRangeError(
                'start',
                `>= 0 and <= ${Number.MAX_SAFE_INTEGER}`,
                start
            );
        }

        this.fd = fd;
        this.path = path;
        this.start = start;

        this.closed = false;
        this.bytesWritten = 0;
        this.pending = true;

        this.autoClose = autoClose;

        if (this.fd === null) {
            this[openFile](flags, mode);
        }

        if (autoClose) {
            this.on('error', (error) => this[closeFile](error));
        }
    }

    [openFile](flags, mode) {
        fs.open(this.path, flags, mode, (error, fd) => {
            if (error) {
                this.emit('error', error);
                return;
            }

            this.fd = fd;
            this.pending = false;
            this.emit('open', fd);
            this.emit('ready');
        });
    }

    [closeFile](err, callback) {
        if (this.fd === null) {
            if (callback) process.nextTick(callback, err);
            return;
        }

        fs.close(this.fd, (error) => {
            error = error || err;
            this.fd = null;
            this.closed = true;
            if (callback) callback(error);
            this.emit('close');
        });
    }

    _write(data, encoding, callback) {
        if (typeof encoding === 'function') {
            callback = encoding;
            encoding = null;
        }

        if (this.fd === null) {
            this.once('open', () => this._write(data, callback));
            return;
        }

        fs.write(this.fd, data, 0, data.length, this.start + this.bytesWritten, (error, bytes) => {
            if (error) {
                if (callback) callback(error);
                return;
            }
            this.bytesWritten += bytes;
            if (callback) callback();
        });
    }

    _writev(data, encoding, callback) {
        if (typeof encoding === 'function') {
            callback = encoding;
            encoding = null;
        }

        if (this.fd === null) {
            this.once('open', () => this._write(data, callback));
            return;
        }

        fs.writev(this.fd, data,  this.start + this.bytesWritten, (error, bytes) => {
            if (error) {
                if (callback) callback(error);
                return;
            }
            this.bytesWritten += bytes;
            if (callback) callback();
        });
    }

    _destroy(err, callback) {
        this[closeFile](err, callback);
    }

    _final(callback) {
        if (this.autoClose) {
            this[closeFile](null, callback);
        }
    }
}

module.exports = Object.freeze({ WritableFileStream });
