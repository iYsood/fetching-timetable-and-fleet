$(document).ready(function() {
  const flightData = {};
  const filesToLoad = {
    sva: ['OEMA-DEP.html', 'OEMA-ARR.html', 'OEMA-DEP.html', 'OEMA-ARR.html', 'OENN-DEP.html', 'OENN-ARR.html', 'OERK-DEP.html', 'OERK-ARR.html'],
    kne: ['OEAB-ARR.html', 'OEAB-ARR.html', 'OEDF-DEP.html', 'OEDF-ARR.html', 'OEJN-DEP.html', 'OEJN-ARR.html', 'OEMA-DEP.html', 'OEMA-ARR.html', 'OERK-DEP.html', 'OERK-ARR.html'],
    fad: ['OEDF-DEP.html', 'OEDF-ARR.html', 'OEJN-DEP.html', 'OEJN-ARR.html', 'OERK-DEP.html', 'OERK-ARR.html'],
  };
  let filesProcessed = 0;

  function showLoading() {
    $('#progress-container').show();
  }

  function hideLoading() {
    $('#progress-container').hide();
  }

  function convertTimestampToTime(timestamp) {
    const date = new Date(parseInt(timestamp));
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  function extractData(htmlString) {
    const timestampRegex = /data-timestamp="(\d+)"/;
    const timeRegex = />([^<]+)<\/strong>/;
    const numberRegex = /<\/strong>\s*<br>\s*([A-Za-z0-9]+)/;

    const timestampMatch = htmlString.match(timestampRegex);
    const timestamp = timestampMatch ? timestampMatch[1] : null;

    const timeMatch = htmlString.match(timeRegex);
    const time = timeMatch ? timeMatch[1] : null;

    const numberMatch = htmlString.match(numberRegex);
    const number = numberMatch ? numberMatch[1] : null;

    return {
      timestamp: timestamp,
      time: time,
      number: number
    };
  }

  function loadTable(url, company) {
    let type = url.substr(5, 3);

    const deferred = $.Deferred();

    $.ajax({
      url: 'schedules/'+ company +'/'+ url,
      method: 'GET'
    }).done(tableHtml => {
      const $tempDiv = $('<div>').html(tableHtml);
      const $table = $tempDiv.find('.table-condensed');
      const $rows = $table.find('tbody tr');

      let this_apt = '';
      let this_callsign = '';
      $rows.each(function() {
        const $row = $(this);
        $row.find('strong.ng-hide').remove();

        $row.find('td').each(function() {
          const $cell = $(this);
          const airport = $cell.html().match(/\/\s*([A-Z]{4})/);
          const iata = $cell.data('iata');
          const icao = airport ? airport[1] : '';
          const callsign = $cell.attr('title');
          const flight = $cell.find('small');

          if (icao !== undefined && icao !== '') {
            if (!flightData[icao]) flightData[icao] = [];
            this_apt = icao;
          }

          if (callsign !== undefined) this_callsign = callsign;

          if (flight.length > 0) {
            const flight2 = extractData(flight.html());
            const depart = convertTimestampToTime(flight2.timestamp);
            const aircraft = flight2.number;

            const $targetCell = $table.find('tbody td').filter(function() {
              return $(this).find('strong[data-timestamp="' + flight2.timestamp + '"]').length > 0;
            });
            const columnIndex = $targetCell.index();
            const $header = $table.find('thead th').eq(columnIndex);
            const dateText = $header.text().trim();
            const date = new Date(`${dateText} 2024`);
            const options = { weekday: 'short' };
            const dayName = new Intl.DateTimeFormat('en-US', options).format(date);

            flightData[this_apt].push({
              flightType: type,
              flightNumber: this_callsign,
              [`${type === 'DEP' ? 'arrivalAirport' : 'departureAirport'}`]: this_apt,
              flightDay: dayName,
              flightTime: depart,
              flightActs: aircraft,
            });
          }
        });
      });

      deferred.resolve();
    }).fail((xhr, status, error) => {
      console.error('Error loading the table:', error);

      deferred.resolve();
    });

    return deferred.promise();
  }

  function loadFleetTable(url) {
    $.ajax({
      url: url,
      method: 'GET'
    }).done(tableHtml => {
      const $tempDiv = $('<div>').html(tableHtml);
      const $table = $tempDiv.find('#list-aircraft');

      // Create an object to store the data
      const aircraftData = {};

      // Iterate through each aircraft type section
      $table.find('dt').each(function() {
        const type = $(this).find('div').first().text().trim(); // Aircraft type
        const $tableBody = $(this).next('dd').find('table tbody');

        // Initialize an array for the current type
        aircraftData[type] = [];

        // Extract data for each aircraft
        $tableBody.find('tr').each(function() {
          const $cells = $(this).find('td');
          const registration = $($cells[0]).text().trim(); // Registration
          const aircraftType = $($cells[1]).text().trim(); // Aircraft Type

          // Push the data to the array
          aircraftData[type].push({
            NAME: aircraftType,
            REG: registration
          });
        });
      });

      console.log(aircraftData);
      const jsonData = JSON.stringify(aircraftData, null, 2);
      $('#container-fetch').html(`<pre>${jsonData}</pre>`);

    }).fail((xhr, status, error) => {
      console.error('Error loading the table:', error);
    });
  }

  function updateProgressBar(company) {
    const progress = ((filesProcessed / filesToLoad[company].length) * 100).toFixed(2);
    $('#progress-bar').css('width', `${progress}%`).attr('aria-valuenow', progress);
  }

  function processSchedules(company) {
    showLoading();

    const loadPromises = filesToLoad[company].map(file => loadTable(file, company));

    $.when.apply($, loadPromises).done(() => {
      hideLoading();

      requestAnimationFrame(() => {
        const flightDataJson = JSON.stringify(flightData, null, 2);
        $('#container-fetch').html(`<pre>${flightDataJson}</pre>`);
      });
    });

    filesToLoad[company].forEach(file => {
      loadTable(file, company).always(() => {
        filesProcessed++;
        updateProgressBar(company);
      });
    });

    disable_btn(false)
  }

  function processFleet(company){
    showLoading();

    let _fleet_page = 'fleet/'+ company +'.html'

    loadFleetTable(_fleet_page)

    disable_btn(false)
  }

  function disable_btn(_state){
    $('.btn-outline-primary').prop('disabled', _state);
    $('.btn-outline-warning').prop('disabled', _state);
    $('.btn-outline-danger').prop('disabled', _state);
  }

  $('#action-button').on('click', '#extracting', function() {
    let _type = $(this).data('id');
    let _which = $(this).data('company');

    disable_btn(true)

    if (_type === 'fleet'){
      processFleet(_which);
    }else{
      processSchedules(_which);
    }
  });

  $('#action-button').on('click', '#clearing', function() {
    location.reload();
  });
});
