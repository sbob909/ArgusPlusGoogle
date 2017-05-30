// class for any valid Argus metric expression
function ArgusData(urlBase, validMetricExploreExpression){
  this.base = urlBase + '/argusws/metrics?expression=',
  this.expression = validMetricExploreExpression,
  this.url = this.base + this.expression,
  this.queryArgus.bind(this), // IIFE to initalize this.dataTable
  this.pivotView = function(precision, groupColNum, filterValue, valueColNum) {
    // helper
    function round(value, decimals) {
      return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
    }

    // create a list of cols to pivot on (if filtered, just use that filter)
    var distinctValues = filterValue ? [filterValue] : this.dataTable.getDistinctValues(groupColNum);
    var viewColumns = [0]; // primary key for each row is col 0
    var groupColumns = [];
    // build column arrays for the view and grouping
    // col 6 has the keys (Argus tags), col 7 has the values
    for (var i = 0; i < distinctValues.length; i++) {
      viewColumns.push({
        type: 'number',
        label: distinctValues[i],
        calc: (function(x) {
          return function(dt, row) {
            return (dt.getValue(row, groupColNum) == x) ?
              round(dt.getValue(row, valueColNum),precision) : null;
          };
        })(distinctValues[i])
      });
      groupColumns.push({
        column: i + 1,
        type: 'number',
        label: distinctValues[i],
        aggregation: google.visualization.data.sum
      });
    } // for

    var view = new google.visualization.DataView(this.dataTable);
    view.setColumns(viewColumns);

    return google.visualization.data.group(view, [0], groupColumns);
  };
}

// helper to round values without rounding errors
function round(value, decimals) {
  return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

// helper to convert bytes to gigabytes
function bytesToGigabytes (bytes) {
  if (isNaN(bytes)) {
    return 0;
  } else {
    var size = bytes/1073741824;
    return round(size,2);
  }
}

// helper function to create column map
function createColumns(dataTable) {
  var columns = [];
  for (var i = 0; i < dataTable.getNumberOfColumns(); i++) {
    columns.push(dataTable.getColumnLabel(i));
  }
  return columns;
}

// helper to get selected column label from pivotView to support drill downs
function getLabel(dataView, sel){

  if (sel.length == 0){
    return '*';
  } else {
    return dataView.getColumnLabel(sel[0].column);
  }
} // getLabel

// helper to filter a dataTable to remove records
function getFilteredView(dataTable, columns, filterCol, filterVal){
  var filteredView = new google.visualization.DataView(dataTable);
  filteredView.setRows(
    filteredView.getFilteredRows([{
      column: columns.indexOf(filterCol),
      value: filterVal}]));
  return filteredView;
} // getFilteredView

// helper to pivot Google DataTable given key and value columns
// necessary to create series data for LineChart, AreaChart, etc.
function createPivotView(dataTable, precision, groupColNum, filterValue, valueColNum){
  // create a list of cols to pivot on (if filtered, just use that filter)
  var distinctValues = filterValue ? [filterValue] : dataTable.getDistinctValues(groupColNum);
  var viewColumns = [0]; // primary key for each row is col 0
  var groupColumns = [];
  // build column arrays for the view and grouping
  // col 6 has the keys (Argus tags), col 7 has the values
  for (var i = 0; i < distinctValues.length; i++) {
    viewColumns.push({
      type: 'number',
      label: distinctValues[i],
      calc: (function(x) {
        return function(dt, row) {
          return (dt.getValue(row, groupColNum) == x) ?
            round(dt.getValue(row, valueColNum),precision) : null;
        };
      })(distinctValues[i])
    });
    groupColumns.push({
      column: i + 1,
      type: 'number',
      label: distinctValues[i],
      aggregation: google.visualization.data.sum
    });
  } // for

  var view = new google.visualization.DataView(dataTable);
  view.setColumns(viewColumns);

  return google.visualization.data.group(view, [0], groupColumns);

} // createPivotView

// load the rest of the dependencies
function loadRest(){
  google.charts.load('current', {'packages':['corechart', 'controls']});

  ArgusData.prototype.queryArgus = function(e){
    var deferred = Q.defer();
    var accessToken = localStorage.getItem('ngStorage-accessToken');
    accessToken = accessToken.slice(1,accessToken.length-1);
    $.ajax({
      url: e.url,
      async: true,
      crossDomain: true,
      dataType: 'json',
      xhrFields: {
        withCredentials: true
      },
      beforeSend: function (xhr) {
        xhr.setRequestHeader ("Authorization", "Bearer " + accessToken);
      },
      success: function (data) {
        // console.log('Data retrieved.');
        // always create new dataTable
        e.dataTable = new google.visualization.DataTable();
        // set the header row
        e.dataTable.addColumn('date', 'timestamp');
        e.dataTable.addColumn('string', 'namespace');
        e.dataTable.addColumn('string', 'scope');
        e.dataTable.addColumn('string', 'metric');
        e.dataTable.addColumn('string', 'displayName');
        e.dataTable.addColumn('string', 'units');
        // handle variable number of tags
        $.each(Object.keys(data[0].tags), function(key,value){
          e.dataTable.addColumn('string', value);
        });
        e.dataTable.addColumn('number', 'value');

        //console.log(Object.keys(data[0].tags));

        // outer loop to create the rows
        for (var i = 0; i < data.length; i++) {
          var dataPoints = Object.entries(data[i].datapoints);
          // inner loop to create a row for every datapoint (timestamp/value)
          dataPoints.forEach(function(element) {
            var row = [];
            row.push(new Date(Number(element[0])));
            row.push(data[i].namespace || 'global');
            row.push(data[i].scope);
            row.push(data[i].metric);
            row.push(data[i].displayName || data[i].metric);
            row.push(data[i].units || 'unknown');
            // handle variable number of tags
            $.each(Object.values(data[i].tags), function(key,value){
              row.push(value);
            });
            row.push(Number(element[1]));
            e.dataTable.addRow(row);
          });
        }
        deferred.resolve();
      }
    });
    return deferred.promise;
  };
}
