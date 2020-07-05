'use strict';

class MethodNotImplementedError extends Error {
    constructor(method) {
        super(`The ${method} method is not implemented!`);
        this.code = 'ERR_METHOD_NOT_IMPLEMENTED';
        this.name += ` [${this.code}]`;
    }
}

class UnknownEncodingError extends Error {
    constructor(encoding) {
        super(`Unknown encoding: ${encoding}`);
        this.code = 'ERR_UNKNOWN_ENCODING';
        this.name += ` [${this.code}]`;
    }
}

class InvalidArgTypeError extends TypeError {
    constructor(argument, expectedType, value) {
        if (Array.isArray(expectedType)) {
            expectedType = expectedType.join(' or ');
        }
        super(
            `The "${argument}" argument must be one of type ${expectedType}. Received type ${typeof value}`
        );
        this.code = 'ERR_INVALID_ARG_TYPE';
        this.name += ` [${this.code}]`;
    }
}

class StreamDestroyedError extends Error {
    constructor(method) {
        super(`Cannot call ${method} after a stream was destroyed`);
        this.code = 'ERR_STREAM_DESTROYED';
        this.name += ` [${this.code}]`;
    }
}

class StreamWriteAfterEndError extends Error {
    constructor() {
        super('Write after end');
        this.code = 'ERR_STREAM_WRITE_AFTER_END';
        this.name += ` [${this.code}]`;
    }
}

class OutOfRangeError extends RangeError {
    constructor(name, range, received) {
        super(
            `The value of "${name}" is out of range. It must be ${range}. Received ${received}`
        );
        this.code = 'ERR_OUT_OF_RANGE';
        this.name += ` [${this.code}]`;
    }
}

module.exports = Object.freeze({
    MethodNotImplementedError,
    UnknownEncodingError,
    InvalidArgTypeError,
    StreamDestroyedError,
    StreamWriteAfterEndError,
    OutOfRangeError,
});
