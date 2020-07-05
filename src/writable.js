'use strict';

const EventEmitter = require('events');
const {
    MethodNotImplementedError,
    UnknownEncodingError,
    InvalidArgTypeError,
    StreamWriteAfterEndError,
    StreamDestroyedError,
} = require('./errors');

const DEFAULT_BUFFER_SIZE = 16 * 1024;

const writableState = Symbol('writableState');
const errorOrDestroy = Symbol('errorOrDestroy');
const callWrite = Symbol('write');
const getBuffers = Symbol('getBuffers');
const callFinish = Symbol('finish');

class Writable extends EventEmitter {
    constructor({
        write = null,
        writev = null,
        final = null,
        destroy = null,
        defaultEncoding = 'utf8',
        highWaterMark = DEFAULT_BUFFER_SIZE,
        emitClose = true,
        autoDestroy = false,
    } = {}) {
        super();

        if (typeof write === 'function') this._write = write;
        if (typeof writev === 'function') this._writev = writev;
        if (typeof final === 'function') this._final = final;
        if (typeof destroy === 'function') this._destroy = destroy;

        this[writableState] = {
            defaultEncoding,
            emitClose,
            autoDestroy,
            highWaterMark,
            destroyed: false,
            ended: false,
            finished: false,
            corked: 0,
            writing: false,
            needDrain: false,
            bytesInQueue: 0,
            buffers: [],
            callbacks: [],
            bytesCorked: 0,
            corkedBuffers: [],
            corkedCallbacks: [],
        };
    }

    cork() {
        this[writableState].corked++;
    }

    uncork() {
        const state = this[writableState];

        if (state.corked > 0) {
            state.corked--;
        }

        if (state.corked === 0) {
            // the `push` method has better performance than the `concat`
            state.buffers.push(...state.corkedBuffers);
            state.callbacks.push(...state.corkedCallbacks);
            state.bytesInQueue += state.bytesCorked;

            state.bytesCorked = 0;
            state.corkedBuffers = [];
            state.corkedCallbacks = [];

            if (!state.writing) {
                const buffers = this[getBuffers]();
                this[callWrite](buffers);
            }
        }
    }

    destroy(error, callback) {
        if (this[writableState].destroyed) {
            throw new StreamDestroyedError('destroy');
        }

        if (typeof error === 'function') {
            callback = error;
            error = null;
        }

        this[writableState].destroyed = true;
        this._destroy(error, (err) => {
            if (callback) {
                callback(err);
            } else if (err) {
                this.emit('error', err);
            }

            if (this[writableState].emitClose) {
                this.emit('close');
            }
        });

        return this;
    }

    setDefaultEncoding(encoding) {
        if (typeof encoding !== 'string') {
            throw new InvalidArgTypeError('encoding', 'string', encoding);
        }
        encoding = encoding.toLowerCase();
        if (!Buffer.isEncoding(encoding)) {
            throw new UnknownEncodingError(encoding);
        }
        this[writableState].defaultEncoding = encoding;
        return this;
    }

    end(chunk, encoding, callback) {
        if (typeof chunk === 'function') {
            callback = chunk;
            chunk = null;
            encoding = null;
        } else if (typeof encoding === 'function') {
            callback = encoding;
            encoding = null;
        }

        if (chunk !== null && chunk !== undefined) {
            this.write(chunk, encoding);
        }

        this[writableState].ended = true;

        if (callback) this.once('finish', callback);

        return this;
    }

    write(chunk, encoding, callback) {
        const state = this[writableState];

        if (typeof encoding === 'function') {
            callback = encoding;
            encoding = state.defaultEncoding;
        }

        if (!encoding) {
            encoding = state.defaultEncoding;
        }

        if (!Buffer.isEncoding(encoding)) {
            throw new UnknownEncodingError(encoding);
        }

        if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string') {
            throw new InvalidArgTypeError('chunk', ['string', 'Buffer'], chunk);
        }

        if (!this._write) {
            throw new MethodNotImplementedError('_write');
        }

        if (typeof chunk === 'string') {
            chunk = Buffer.from(chunk, encoding);
        }

        let err;
        if (state.ended) {
            err = new StreamWriteAfterEndError();
        } else if (state.destroyed) {
            err = new StreamDestroyedError('write');
        }

        if (err) {
            process.nextTick(callback, err);
            this[errorOrDestroy](err);
            return false;
        }

        if (callback) {
            if (state.corked) {
                state.corkedCallbacks.push(callback);
            } else {
                state.callbacks.push(callback);
            }
        }

        if (state.corked) {
            state.corkedBuffers.push(chunk);
            state.bytesCorked += chunk.length;
        } else if (state.writing) {
            state.buffers.push(chunk);
            state.bytesInQueue += chunk.length;
        } else {
            this[callWrite](chunk);
        }

        state.needDrain = this.writableLength >= state.highWaterMark;

        return !state.needDrain;
    }

    [callWrite](data) {
        const state = this[writableState];

        state.writing = true;

        const callbacks = state.callbacks;
        state.callbacks = [];

        const callback = (error) => {
            callbacks.forEach((cb) => cb(error));

            if (error) {
                this[errorOrDestroy](error);
            }

            if (!state.bytesInQueue) {
                state.writing = false;
                if (state.needDrain) {
                    state.needDrain = false;
                    this.emit('drain');
                }

                if (state.ended) this[callFinish]();
            } else {
                const buffers = this[getBuffers]();
                this[callWrite](buffers);
            }
        };

        if (!this._write && !this._writev) {
            throw new MethodNotImplementedError('_write and _writev');
        }

        if (Array.isArray(data)) {
            if (this._writev) {
                this._writev(data, callback);
            } else {
                this._write(Buffer.concat(data), callback);
            }
        } else {
            this._write(data, callback);
        }
    }

    [getBuffers]() {
        const { buffers } = this[writableState];
        this[writableState].buffers = [];
        this[writableState].bytesInQueue = 0;
        return buffers;
    }

    [errorOrDestroy](error) {
        if (this[writableState].autoDestroy) {
            this.destroy(error);
        } else if (error) {
            this.emit('error', error);
        }
    }

    [callFinish]() {
        this[writableState].finished = true;
        this._final((error) => {
            this.emit('finish');
            this[errorOrDestroy](error);
        });
    }

    _final(callback) {
        if (callback) callback();
    }

    _destroy(err, callback) {
        if (callback) callback(err);
    }

    get destroyed() {
        return this[writableState].destroyed;
    }

    get writable() {
        const { needDrain, ended, destroyed } = this[writableState];
        return !needDrain && !ended && !destroyed;
    }

    get writableEnded() {
        return this[writableState].ended;
    }

    get writableFinished() {
        return this[writableState].finished;
    }

    get writableHighWaterMark() {
        return this[writableState].highWaterMark;
    }

    get writableLength() {
        return (
            this[writableState].bytesInQueue + this[writableState].bytesCorked
        );
    }

    get writableCorked() {
        return this[writableState].corked;
    }
}

module.exports = Object.freeze({ Writable });
