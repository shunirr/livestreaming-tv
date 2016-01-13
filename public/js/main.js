(function() {
  'use strict';

  var videoSrc = 'hls/stream.m3u8';
  var video;
  var timeoutID;

  function parseJson(response) {
    return response.json();
  }

  function formatDate(date) {
    return date.getHours() + ':' + ('0' + date.getMinutes()).substr(-2);
  }

  function selectChannel(event) {
    var ch = event.target.getAttribute('id');
    var body = new FormData();
    body.append('ch', ch);
    fetch('channels/select', {
      method: 'post',
      body: body,
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    });
  }

  function getCurrentChannel() {
    clearTimeout(timeoutID);
    fetch('channels/current', {
      method: 'get',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(parseJson).then(function(json) {
      var elements = document.getElementsByClassName('selected');
      while (elements[0]) {
        elements[0].classList.remove('selected');
      }
      Array.prototype.forEach.call(document.getElementsByClassName(json[1]), function(element) {
        element.classList.add('selected');
      });
      timeoutID = setTimeout(function() { getCurrentChannel(); }, 60 * 1000);
    });
  }

  function updateProgrammes() {
    fetch('programmes', {
      method: 'get',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(parseJson).then(function(programmes) {
      var timetable = document.getElementById('timetable');
      while (timetable.firstChild) {
        timetable.removeChild(timetable.firstChild);
      }
      var now = new Date();
      var lastDate = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      var table = document.createElement('table');
      table.className = 'mdl-data-table';
      var channels = {};
      programmes.forEach(function(programme) {
        var start = new Date(programme.start);
        var stop = new Date(programme.stop);
        if (typeof channels[programme.name] === 'undefined') {
          channels[programme.name] = [];
          if (start.getTime() > now.getTime()) {
            channels[programme.name].push({
              'start': now,
              'stop': start,
              'title':'NO DATA'
            });
          }
        }
        channels[programme.name].push(programme);
      });
      var nextReloadTime;
      Object.keys(channels).forEach(function(key) {
        var programmes = channels[key];
        var programme = programmes[programmes.length-1];
        var stop = new Date(programme.stop);
        if (stop.getTime() < lastDate.getTime()) {
          programmes.push({
            'start': stop,
            'stop': lastDate,
            'title':'NO DATA'
          });
        }
        var currentTime = new Date(programmes[0].stop);
        if (typeof nextReloadTime === 'undefined'
              || nextReloadTime.getTime() > currentTime.getTime()) {
          nextReloadTime = currentTime;
        }
      });
      {
        var tr = document.createElement('tr');
        var width = (100 / Object.keys(channels).length) + '%';
        Object.keys(channels).forEach(function(key) {
          var remoconNumber = channels[key][0].remocon_number;
          var th = document.createElement('th');
          th.classList.add(remoconNumber);
	  th.classList.add('mdl-data-table__cell--non-numeric');
          th.setAttribute('width', width);
          var anchor = document.createElement('a');
          anchor.textContent = key;
          anchor.id = remoconNumber;
          anchor.setAttribute('href', 'javascript:void(0)');
          anchor.addEventListener('click', selectChannel);
          th.appendChild(anchor);
          tr.appendChild(th);
        });
        table.appendChild(tr);
      }
      getCurrentChannel();

      for (var i = 0; i < 6 * 60; i++) {
        var tr = document.createElement('tr');
        Object.keys(channels).forEach(function(key) {
          for (var j = 0; j < channels[key].length; j++) {
            var programme = channels[key][j];
            var start = new Date(programme.start);
            var stop = new Date(programme.stop);
            var pos = Math.floor((start - now) / 60000);
            var remoconNumber = channels[key][0].remocon_number;
            var height;
            if (i == pos) {
              height = Math.floor((stop - start) / 60000);
            } else {
              height = Math.floor((stop - now) / 60000);
            }
            if (height > 0) {
              if ((i == 0 && j == 0) || i == pos) {
                var td = document.createElement('td');
                td.classList.add(remoconNumber);
	        td.classList.add('mdl-data-table__cell--non-numeric');
                td.textContent = [formatDate(start), programme.title].join(' ');
                td.setAttribute('valign', 'top');
                td.setAttribute('rowspan', height);
                tr.appendChild(td);
              }
            }
          };
        });
        table.appendChild(tr);
      }
      timetable.appendChild(table);

      if (typeof nextReloadTime === 'undefined' || nextReloadTime.getTime() <= 0) {
        setTimeout(function() { updateProgrammes(); }, 5 * 60 * 1000);
      } else {
        setTimeout(function() { updateProgrammes(); }, (nextReloadTime - now));
      }
    });
  }

  function capture() {
    if (typeof video === 'undefined') {
      return;
    }
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    var body = new FormData();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    body.append('url', canvas.toDataURL());
    fetch('tweet', {
      method: 'post',
      body: body,
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function() {
      canvas = undefined;
    });
  }

  function bind() {
    var hls;
    video = document.getElementById('video');
    if (video.canPlayType('application/vnd.apple.mpegURL')) {
      video.setAttribute('src', videoSrc);
    } else if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PASED, video.play.bind(video));
    } else {
      return;
    }
    updateProgrammes();
  }

  window.addEventListener('keyup', function(event) {
    if (event.keyCode === 84) {
      capture();
    }
  });
  document.addEventListener('DOMContentLoaded', bind);
})();
