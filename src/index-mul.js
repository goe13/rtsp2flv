const express = require('express');
const expressWebSocket = require("express-ws");
const ffmpeg = require("fluent-ffmpeg");
const webSocketStream = require("websocket-stream/stream");

function localServer() {
  let app = express();
  app.use(express.static(__dirname));
  // extend express app with app.ws()
  expressWebSocket(app, null, {
    perMessageDeflate: true
  });
  app.ws("/rtsp/:id/", rtspRequestHandle)
  app.listen(8888);
  console.log("express listened :8888")
}


const ffmpegHanlder = (() => {
  let reqs = {};
  let id = 0;
  console.log(reqs, id)
  return (url, ws) => {
    let i = id++
    // convert ws instance to stream
    let stream = webSocketStream(ws, {
      binary: true,
      browserBufferTimeout: 1000000
    }, {
      browserBufferTimeout: 1000000
    });
    console.log(i)
    if (reqs[url]) {
      reqs[url].conns.push({ stream, ws, id: i })
    } else {
      reqs[url] = {
        ffmpegCommand: null,
        conns: []
      }
      reqs[url].conns.push({ stream, ws, id: i })
      // ffmpet转码
      reqs[url].ffmpegCommand = ffmpeg(url)
        .addInputOption("-rtsp_transport", "tcp", "-buffer_size", "102400")  // 这里可以添加一些 RTSP 优化的参数
        .on("start", function () {
          console.log(url, "Stream started.");
          reqs[url].conns.forEach(v => {
            v.ws.send('');
          })
        })
        .on("codecData", function () {
          console.log(url, "Stream codecData.")
          // 摄像机在线处理
        })
        .on("error", function (err) {
          console.log(url, "An error occured: ", err.message);
          reqs[url].conns.forEach(v => {
            v.stream.end();
          })
        })
        .on("end", function () {
          console.log(url, "Stream end!");
          reqs[url].conns.forEach(v => {
            v.stream.end();
          })
          // 摄像机断线的处理
        })
        .outputFormat("flv").videoCodec("copy").noAudio(); // 输出格式flv 无音频
    }
    console.log(i)
    ws.on('close', () => {
      let index = reqs[url].conns.findIndex(v = v.id === 1);
      reqs[url].splice(index, 1)
    })
    stream.on("close", () => {
      if (reqs[url].conns.length === 0) {
        reqs[url].ffmpegCommand.kill('SIGKILL');
      }
    });
    try {
      reqs[url].ffmpegCommand.pipe(stream)
    } catch (error) {
      console.log(error);
    }

  }
})();

function rtspRequestHandle(ws, req) {
  console.log(ws.url, `ws://localhost:8888/rtsp/${req.params.id}/${req.query.url}`)
  console.log("rtsp request handle");
  let url = req.query.url;
  ffmpegHanlder(url, ws)
}

localServer()