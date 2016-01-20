(function() {
  'use strict';

  var videoSrc = 'hls/stream.m3u8';
  var video;
  var timetable;
  var timeoutID;

  function parseJson(response) {
    return response.json();
  }

  function formatDate(date) {
    return date.getHours() + ':' + ('0' + date.getMinutes()).substr(-2);
  }

  function createDummyData(start, stop) {
    return {
      start: start,
      stop: stop,
      title: 'NO DATA',
      desc: '',
      startObj: new Date(start),
      stopObj: new Date(stop),
      isDummy: true
    };
  }

  function removeChildren(element) {
    var child;
    while ((child = element.firstChild)) {
      element.removeChild(child);
    }
    return element;
  }

  function selectChannelViews(ch) {
    var elements = document.getElementsByClassName('selected');
    while (elements[0]) {
      elements[0].classList.remove('selected');
    }
    Array.prototype.forEach.call(document.getElementsByClassName('remocon-number-' + ch), function(element) {
      element.classList.add('selected');
    });
  }

  function selectChannel(event) {
    event.preventDefault();
    var ch = this.dataset.remoconNumber;
    var body = new FormData();
    body.append('ch', ch);
    fetch('channels/select', {
      method: 'post',
      body: body,
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function() {
      selectChannelViews(ch);
    });
    return false;
  }

  function getCurrentChannel() {
    clearTimeout(timeoutID);
    fetch('channels/current', {
      method: 'get',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(parseJson).then(function(json) {
      selectChannelViews(json[1]);
      timeoutID = setTimeout(function() { getCurrentChannel(); }, 60 * 1000);
    });
  }

  function updateProgrammes() {
    fetch('programmes', {
      method: 'get',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(parseJson).then(generateTimetable);
  }

  function generateTimetable(programmes) {
    timetable = timetable || document.getElementById('timetable');
    removeChildren(timetable);
    var now = new Date();
    now.setSeconds(0, 0);
    var actualLastDate = now;
    var lastDate = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    var channels = {};
    programmes.forEach(function(programme) {
      var start = new Date(programme.start);
      var stop = new Date(programme.stop);
      start.setSeconds(0, 0);
      stop.setSeconds(0, 0);
      // to ensure 'height' > 0
      if (now >= stop || start >= lastDate || start >= stop) {
        return;
      }
      if (!channels[programme.channel]) {
        channels[programme.channel] = {
          name: programme.name,
          remoconNumber: programme.remocon_number,
          programmes: [],
        };
      }
      if (actualLastDate < stop) {
        actualLastDate = stop;
      }
      programme.startObj = start;
      programme.stopObj = stop;
      channels[programme.channel].programmes.push(programme);
    });
    Object.keys(channels).forEach(function(channelId) {
      var programmes = channels[channelId].programmes;
      // head padding : Note that programmes.length is always non-zero.
      var firstProgrammeStart = programmes[0].startObj;
      if (firstProgrammeStart > now) {
        programmes.unshift(createDummyData(now, firstProgrammeStart));
      }
      // tail padding
      var lastProgrammeStop = programmes[programmes.length - 1].stopObj;
      if (actualLastDate > lastProgrammeStop) {
        programmes.push(createDummyData(lastProgrammeStop, actualLastDate));
      }
      // body padding
      var i, len;
      for (i = 1, len = programmes.length; i < len; ++i) {
        if (programmes[i - 1].stopObj < programmes[i].startObj) {
          programmes.splice(i, 0, createDummyData(programmes[i - 1].stopObj, programmes[i].startObj));
          i++;
          len++;
        }
      }
    });
    timetable.appendChild(generateTable(channels, now, actualLastDate));
    getCurrentChannel();
    setTimeout(updateProgrammes, calculateReloadInterval(channels));
  }

  function calculateReloadInterval(channels) {
    var nextReloadTime;
    Object.keys(channels).forEach(function(channelId) {
      if (!nextReloadTime || nextReloadTime > channels[channelId].programmes[0].stopObj) {
        nextReloadTime = channels[channelId].programmes[0].stopObj;
      }
    });
    var interval = nextReloadTime - (new Date());
    return (interval > 0) ? interval : 5 * 60 * 1000;
  }

  function generateTable(channels, firstDateToShow, lastDateToShow) {
    var table = document.createElement('table');
    table.classList.add('mdl-data-table');
    table.appendChild(generateTableHeader(channels));
    table.appendChild(generateTableBody(channels, firstDateToShow, lastDateToShow));
    return table;
  }

  function generateTableHeader(channels) {
    var channelIds = Object.keys(channels);
    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    var width = (100 / channelIds.length) + '%';
    channelIds.forEach(function(channelId) {
      var channel = channels[channelId];
      var remoconNumber = channel.remoconNumber;
      var th = document.createElement('th');
      th.classList.add('remocon-number-' + remoconNumber);
      th.classList.add('mdl-data-table__cell--non-numeric');
      th.setAttribute('width', width);
      var anchor = document.createElement('a');
      anchor.textContent = channel.name;
      anchor.id = 'remocon-number-' + remoconNumber;
      anchor.dataset.remoconNumber = remoconNumber;
      anchor.href = 'javascript:void(0);';
      anchor.addEventListener('click', selectChannel);
      th.appendChild(anchor);
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
  }

  function fillTd(td, programme){
    if (programme.isDummy) {
      td.classList.add('dummy-programme');
    } else {
      td.classList.add('programme');
      var strong = document.createElement('strong');
      strong.textContent = formatDate(programme.startObj);
      td.appendChild(strong);
      var text = document.createTextNode(' ' + programme.title);
      td.appendChild(text);
      var desc = document.createElement('span');
      desc.className = "description";
      desc.innerHTML = programme.desc;
      td.appendChild(desc);
    }
  }

  function generateTableBody(channels, head, tail) {
    var tbody = document.createElement('tbody');
    var tr = document.createElement('tr');
    var minuteHeight = 3;
    Object.keys(channels).forEach(function(channelId) {
      var remoconNumber = channels[channelId].remoconNumber;
      var td = document.createElement('td');
      td.classList.add('remocon-number-' + remoconNumber);
      td.classList.add('mdl-data-table__cell--non-numeric');
      td.style.height = (minuteHeight * (tail-head) / 60000) + "px";

      channels[channelId].programmes.forEach(function(programme) {
        var start = (programme.startObj < head) ? head : programme.startObj;
        var position = Math.floor((programme.startObj - head) / 60000);
        var minutes = Math.floor((programme.stopObj - start) / 60000);
        var div = document.createElement('div');
        div.style.top = (minuteHeight * position) + "px";
        div.style.minHeight = (minuteHeight * minutes) + "px";
        div.style.width = "100%";
        fillTd(div, programme);
        td.appendChild(div);
      });
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    return tbody;
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
