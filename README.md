# Writable Streams
My own simple implementation of `Writable` (`stream.Writable`) and `WritableFileStream` (`fs.WriteStream`) streams. 

This implementation does not support some features of the built-in `Node.js` streams. For example, such parameters of the `Writable` stream as are not supported:
- `decodeStrings`
- `objectMode`

You can learn more about these parameters in [Node.js documentation](https://nodejs.org/dist/latest-v12.x/docs/api/stream.html#stream_constructor_new_stream_writable_options).