(function() {
  'use strict';

  var videoSrc = 'hls/stream.m3u8';
  var remoconNumbers = {};
  var channelIds;
  var channelNames = {};
  var video;
  var timetable;
  var timeoutID;
  var now;
  var actualLastDate;
  var nextReloadTime;

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
    nextReloadTime = undefined;
    timetable = timetable || document.getElementById('timetable');
    removeChildren(timetable);
    now = new Date();
    now.setSeconds(0, 0);
    actualLastDate = now;
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
      channels[programme.channel] = channels[programme.channel] || [];
      channelNames[programme.channel] = programme.name;
      remoconNumbers[programme.channel] = remoconNumbers[programme.channel] || programme.remocon_number;
      if (actualLastDate < stop) {
        actualLastDate = stop;
      }
      programme.startObj = start;
      programme.stopObj = stop;
      channels[programme.channel].push(programme);
    });
    channelIds = Object.keys(channels);
    channelIds.forEach(function(channelId) {
      var programmes = channels[channelId];
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
      var firstProgrammeStop = programmes[0].stopObj;
      if ((nextReloadTime || 0) <= firstProgrammeStop) {
        return;
      }
      nextReloadTime = firstProgrammeStop;
    });
    timetable.appendChild(generateTable(channels));
    getCurrentChannel();
    now = new Date(); // without setSeconds(0, 0);
    if (!nextReloadTime || nextReloadTime - now <= 0) {
      setTimeout(updateProgrammes, 5 * 60 * 1000);
    } else {
      setTimeout(updateProgrammes, nextReloadTime - now);
    }
  }

  function generateTable(channels) {
    var table = document.createElement('table');
    table.classList.add('mdl-data-table');
    table.appendChild(generateTableHeader(channels));
    table.appendChild(generateTableBody(channels));
    return table;
  }

  function generateTableHeader(channels) {
    var thead = document.createElement('thead');
    var tr = document.createElement('tr');
    var width = (100 / channelIds.length) + '%';
    channelIds.forEach(function(channelId) {
      var remoconNumber = remoconNumbers[channelId];
      var th = document.createElement('th');
      th.classList.add('remocon-number-' + remoconNumber);
      th.classList.add('mdl-data-table__cell--non-numeric');
      th.setAttribute('width', width);
      var anchor = document.createElement('a');
      anchor.textContent = channelNames[channelId];
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

  function generateTableBody(channels) {
    var tbody = document.createElement('tbody');
    var count = Math.floor((actualLastDate - now) / 60000);
    var timetableRows = new Array(count);
    var i, len;
    for (i = 0, len = timetableRows.length; i < len; ++i) {
      timetableRows[i] = [];
    }
    channelIds.forEach(function(channelId) {
      var programmes = channels[channelId];
      programmes.forEach(function(programme) {
        var start = programme.startObj;
        if (start < now) {
          start = now;
        }
        var pos = Math.floor((start - now) / 60000);
        programme.height = Math.floor((programme.stopObj - start) / 60000);
        if (0 > pos || pos >= len) {
          return;
        }
        timetableRows[pos].push(programme);
      });
    });
    timetableRows.forEach(function(timetableRow) {
      var tr = document.createElement('tr');
      timetableRow.forEach(function(programme) {
        var remoconNumber = programme.remocon_number;
        var td = document.createElement('td');
        td.classList.add('remocon-number-' + remoconNumber);
        td.classList.add('mdl-data-table__cell--non-numeric');
        var strong;
        var text;
        if (programme.isDummy) {
          td.classList.add('empty');
        } else {
          strong = document.createElement('strong');
          strong.textContent = formatDate(programme.startObj);
          td.appendChild(strong);
          text = document.createTextNode(' ' + programme.title);
          td.appendChild(text);
        }
        td.setAttribute('valign', 'top');
        td.setAttribute('rowspan', programme.height);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
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
