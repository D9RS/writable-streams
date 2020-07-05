'use strict';

const { WritableFileStream } = require('./src/fs-write-stream');
const { Writable } = require('./src/writable');

module.exports = Object.freeze({
    Writable,
    WritableFileStream,
});
