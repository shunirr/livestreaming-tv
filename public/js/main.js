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

  function createDummyData(start, stop) {
    return {
      'start': start,
      'stop': stop,
      'title':'NO DATA'
    };
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
      now.setSeconds(0, 0);
      var lastDate = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      var actualLastDate = now;
      var table = document.createElement('table');
      table.className = 'mdl-data-table';
      var channels = {};
      programmes.forEach(function(programme) {
        var start = new Date(programme.start);
        var stop = new Date(programme.stop);
        if (now < stop && start < lastDate) {
          if (typeof channels[programme.name] === 'undefined') {
            channels[programme.name] = [];
          }
          if (actualLastDate < stop) {
            actualLastDate = stop;
          }
          channels[programme.name].push(programme);
        }
      });
      var nextReloadTime;
      Object.keys(channels).forEach(function(key) {
        var programmes = channels[key];
        // head padding : Note that programmes.length is always non-zero.
        var firstProgrammeStart = new Date(programmes[0].start);
        if (firstProgrammeStart > now) {
          programmes.unshift(createDummyData(now, firstProgrammeStart));
        }
        // tail padding
        var lastProgrammeStop = new Date(programmes[programmes.length - 1].stop);
        if (actualLastDate > lastProgrammeStop) {
          programmes.push(createDummyData(lastProgrammeStop, actualLastDate));
        }
        // body padding
        for (var i = 0; i < programmes.length - 1; i++) {
          var programme = programmes[i];
          var stop = new Date(programme.stop);
          var nextStart = new Date(programmes[i + 1].start);
          if (stop < nextStart) {
            programmes.splice(i + 1, 0, createDummyData(stop, nextStart));
            i++;
          }
        }
        var firstProgrammeStop = new Date(programmes[0].stop);
        if (typeof nextReloadTime === 'undefined'
              || nextReloadTime > firstProgrammeStop) {
          nextReloadTime = firstProgrammeStop;
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

      var timeTics = Math.floor((actualLastDate - now) / 60000);
      for (var i = 0; i < timeTics; i++) {
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
                if (programme.title == "NO DATA") {
                  td.classList.add('empty');
                } else {
                  var strong = document.createElement('strong');
                  strong.textContent = formatDate(start);
                  td.appendChild(strong);
                  var text = document.createTextNode(' ' + programme.title);
                  td.appendChild(text);
                }
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
