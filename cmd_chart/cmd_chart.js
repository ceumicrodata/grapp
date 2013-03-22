function cmd_chart(selection, metaData, appSettings ) {

  var chartDescription = selection.select(".chartDescription");

  selection.select(".chartContainer").each(function () {

      // Prepare HIstory.js
      var History = window.History; // Note: We are using a capital H instead of a lower h
      var isHistoryEnabled = History.enabled;
      if (!isHistoryEnabled) {
          console.log("Warning: History.js not supported!");
      }
      History.Adapter.bind(window, 'statechange', function () {
          var state = History.getState();
          console.log("History state changed: " + state.title);

          loadDataAndRedraw(state.data);
      });

      function changeState(stateData) {


          if (stateData.keyPath === undefined)
              stateData.keyPath = getKeyPath();
          if (stateData.isZoom === undefined)
              stateData.isZoom = false;
          if (stateData.isInitial === undefined)
              stateData.isInitial = false;

          var timeDomain = scalesTime.domain();

          if (stateData.timeFrom === undefined)
              stateData.timeFrom = timeDomain[0];
          if (stateData.timeTo === undefined)
              stateData.timeTo = timeDomain[1];

          var dateFrom = metaData.dateFormat(new Date(stateData.timeFrom));
          var dateTo = metaData.dateFormat(new Date(stateData.timeTo));
          var url = "?keyPath=" + stateData.keyPath + "&dateFrom=" + dateFrom + "&dateTo=" + dateTo;
          var title = "CEU Microdata (testurl: " + url + ")";

          if (isHistoryEnabled) {
              var currentStateData = History.getState().data;
              var doReplace = (stateData.isInitial) || (stateData.isZoom && currentStateData.isZoom && stateData.keyPath == currentStateData.keyPath);
              if (doReplace)
                  History.replaceState(stateData, title, url);
              else
                  History.pushState(stateData, title, url);
          }
          else
              loadDataAndRedraw(stateData);
      }

      /////////////////////////////////////

      var expandedKeys = new Array();
      var keyPathDelimiter = "/";

      function getLastKey() {
          if (expandedKeys.length > 0)
              return expandedKeys[expandedKeys.length - 1];
          else
              return false;
      }
      function getLastKeyOfPath(keyPath) {
          var keys = keyPath.split(keyPathDelimiter);
          if (keys.length > 0)
              return keys[keys.length - 1];
          else
              return false;
      }
      function getKeyPath() {
          return expandedKeys.join(keyPathDelimiter);
      }
      function setKeyPath(keyPath) {
          expandedKeys = (keyPath == "") ? new Array() : keyPath.split(keyPathDelimiter);
      }
      function getLevelIndex() {
          return expandedKeys.length;
      }
      function getLevelIndexOfPath(keyPath) {
          return (keyPath == "") ? 0 : keyPath.split(keyPathDelimiter).length;
      }

      /////////////////////////////////////

      var series = new Object();

      //var currentLevelIndex = 0;
      var currentLevel = metaData.levels[0];

      var totalWidth = $(this).width();
      var totalHeight = $(this).height();

      var width = totalWidth - 2 * appSettings.margin;
      var height = totalHeight - 2 * appSettings.margin;

      var timeMin = metaData.dateFormat.parse(metaData.dateMin).getTime();
      var timeMax = metaData.dateFormat.parse(metaData.dateMax).getTime();

      var scalesTime = d3.time.scale()
      .range([0, width])
      .domain([metaData.dateFormat.parse(metaData.dateFrom).getTime(), metaData.dateFormat.parse(metaData.dateTo).getTime()]);
      var scalesValue = d3.scale.linear()
      .range([height, 0])
      .domain([metaData.valueMin, metaData.valueMax]);

      var xAxis = d3.svg.axis()
      .scale(scalesTime)
      .orient("bottom")
      .tickPadding(6)
      .tickSize(height);

      var yAxis = d3.svg.axis()
      .scale(scalesValue)
      .orient("left")
      .tickPadding(3)
      .tickSize(width);

      ////////////////

      function loadDataAndRedraw(stateData) {

          function queryAndDraw(query) {

              var url = query.url(dateFrom, dateTo, getLastKey());

              console.log("AJAX Query: " + url);
              d3.json(url, function (data) {

                  var table = data[query.tableName];
                  var newSeries = new Object();
                  for (var i = 0; i < table.length; i++) {
                      var key = table[i][query.serieKey];
                      if (!series[key]) {
                          series[key] = new Array();
                          series[key].keyPath = getKeyPath();
                          series[key].onClick = query.onClick;
                          console.log("Serie added:" + key);

                      }

                      var date = metaData.dateFormat.parse(table[i][query.dateKey]).getTime();
                      var value = table[i][query.valueKey];

                      var foundExisting = false;
                      for (var d = 0; d < series[key].length; d++)
                          if (series[key][d].date == date) {
                              series[key][d].value = value;
                              foundExisting = true;
                              break;
                          }
                      if (!foundExisting)
                          series[key].push({ "date": date, "value": value });
                  }

                  function bindEvents(ss) {
                      series[ss].path.on("mousemove", function () {
                          onMouseMove();
                      });
                      series[ss].path.on("click", function () {
                          onClick();
                      });
                      series[ss].path.on("mouseout", function () {
                          onMouseOut();
                      });
                  }

                  var keyPath = getKeyPath();
                  var lastKey = getLastKey();
                  for (s in series) {
                      series[s].sort(function (a, b) { return a.date - b.date; });
                      if (!series[s].path) {

                          series[s].color = (typeof (query.color) == "function") ? query.color(s) : query.color;
                          series[s].styleName = (typeof (query.styleName) == "function") ? query.styleName(s) : query.styleName;

                          series[s].keyPath = keyPath;
                          series[s].path = clippedArea.append("svg:path")
                                  .attr("d", line(series[lastKey ? lastKey : s]))
                                  .classed(series[s].styleName, true)
                                  .style("stroke", lastKey ? series[s].color : d3.rgb(255, 255, 255).toString());

                          bindEvents(s);

                      }
                  }

                  if (numOfQueriesToPerform > 1)
                      numOfQueriesToPerform--;
                  else {
                      redraw(stateData.isZoom);

                      if (zoomTimer)
                          clearTimeout(zoomTimer);
                      zoomTimer = null;

                  }

              });
          }

          ////////////////////////////////////////////////////////////////

          zoomTimer = false;

          var currentKeyPath = getKeyPath();

          if (stateData.keyPath != currentKeyPath) {
              var newLevelIndex = getLevelIndexOfPath(stateData.keyPath);
              if (newLevelIndex < 0 && newLevelIndex >= metaData.levels.length) {
                  console.log("Invalid level: " + levelIndex);
                  return;
              } else {
                  setKeyPath(stateData.keyPath);
                  currentLevel = metaData.levels[levelIndex];
              }
          }

          var dateFrom = metaData.dateFormat(new Date(stateData.timeFrom));
          var dateTo = metaData.dateFormat(new Date(stateData.timeTo));
          
          var timeDomain = scalesTime.domain();
          timeDomain[0] = stateData.timeFrom;
          timeDomain[1] = stateData.timeTo;

          var numOfQueriesToPerform = currentLevel.queries.length;
          for (q = 0; q < currentLevel.queries.length; q++) {
              queryAndDraw(currentLevel.queries[q], dateFrom, dateTo);
          }
      }

      function redraw(instant) {

          var timeDomain = scalesTime.domain();
          var restricted = false;
          if (timeDomain[0] < timeMin) {
              restricted = true;
              timeDomain[0] = timeMin;
          }
          if (timeDomain[1] > timeMax) {
              restricted = true;
              timeDomain[1] = timeMax;
          }
          if (restricted)
              scalesTime.domain(timeDomain);

          if (instant) {
              for (s in series)
                  series[s].path.attr("d", line(series[s]));
          }
          else {
              var currentLevelIndex = getLevelIndex();
              for (s in series) {
                  var levelIndex = getLevelIndexOfPath(series[s].keyPath);
                  if (levelIndex == currentLevelIndex)
                      series[s].path.classed("clicked", false).transition()
              .duration(appSettings.transitionSpeed)
              .attr("d", line(series[s]))
              .style("stroke", series[s].color);
                  else if (levelIndex < currentLevelIndex)
                      series[s].path.transition()
              .duration(appSettings.transitionSpeed)
              .attr("d", line(series[s]))
              .style("stroke", d3.rgb(240, 240, 240).toString());
                  else if (levelIndex > currentLevelIndex) {
                      series[s].path.transition()
              .duration(appSettings.transitionSpeed)
              .attr("d", line(series[getLastKeyOfPath(series[s].keyPath)]))
              .remove();

                      delete series[s];
                  }
              }
          }

          for (si = 0; si < metaData.shadedIntervals.length; si++) {
              var timeFrom = metaData.dateFormat.parse(metaData.shadedIntervals[si].dateFrom).getTime();
              var timeTo = metaData.dateFormat.parse(metaData.shadedIntervals[si].dateTo).getTime();
              svgShadedIntervals[si]
        .attr("x", (scalesTime(timeFrom)) + "px")
        .attr("width", (scalesTime(timeTo) - scalesTime(timeFrom)) + "px");
          }

          if (instant) {
              svgXaxis.call(xAxis);
              svgYaxis.call(yAxis);
          }
          else {
              svgXaxis.transition().duration(appSettings.transitionSpeed).call(xAxis);
              svgYaxis.transition().duration(appSettings.transitionSpeed).call(yAxis);

              svgTitle.text(currentLevel.title);
              chartDescription.text(currentLevel.description);
          }
      }

      //////////////////////////////////
      //
      // Event handling
      //
      //////////////////////////////////

      function getNearestSerie(tooltipInfo) {
          var coords = d3.mouse(clippedArea.node());
          if (coords[0] < 0 || coords[0] > width || coords[1] < 0 || coords[1] > height)
              return false;

          var currentTime = scalesTime.invert(coords[0]);
          var currentValue = scalesValue.invert(coords[1]);

          var lowestDistance = (metaData.valueMax - metaData.valueMin) * appSettings.lineSenitiveWidth / width;
          var nearestSerie = false;

          var currentKeyPath = getKeyPath();
          for (s in series) {
              if (series[s].keyPath == currentKeyPath) {

                  var pos = -1;
                  for (var i = 0; i < series[s].length; i++) {
                      if (currentTime < series[s][i].date) {
                          pos = i - 1;
                          break;
                      }
                  }
                  if (pos >= 0) {
                      var f = (currentTime - series[s][pos].date) / (series[s][pos + 1].date - series[s][pos].date);
                      var v = series[s][pos].value * (1 - f) + series[s][pos + 1].value * f;

                      var currentDistance = Math.abs(v - currentValue);
                      if (currentDistance < lowestDistance) {
                          lowestDistance = currentDistance;
                          nearestSerie = s;

                          if (tooltipInfo) {
                              tooltipInfo.tooltipDate = (f > 0.5) ? series[s][pos + 1].date : series[s][pos].date;
                              tooltipInfo.tooltipValue = (f > 0.5) ? series[s][pos + 1].value : series[s][pos].value;
                          }
                      }
                  }
              }
          }
          return nearestSerie;
      }

      function onMouseMove() {
          if (zoomTimer !== null)
              return;
          var tooltipInfo = new Object();
          var nearestSerie = getNearestSerie(tooltipInfo);
          for (s in series)
              series[s].path.classed("mouseover", (s == nearestSerie));

          if (nearestSerie) {

              var px = scalesTime(tooltipInfo.tooltipDate);
              var py = scalesValue(tooltipInfo.tooltipValue);
              svgTooltipDot.style("display", "block")
          .attr("cx", px + "px")
          .attr("cy", py + "px")
          .style("stroke", series[nearestSerie].color)
          .style("fill", series[nearestSerie].color);

              svgTooltipText.text(metaData.tooltipText(nearestSerie, tooltipInfo.tooltipDate, tooltipInfo.tooltipValue))
          .style("display", "block")
          .attr("x", px + "px")
          .attr("y", py + "px")
          .style("text-anchor", px > width / 2 ? "end" : "start");


          }
          else {
              svgTooltipDot.style("display", "none");
              svgTooltipText.style("display", "none");
          }
      }

      function onClick() {

          var nearestSerie = getNearestSerie();
          if (nearestSerie) {
              /*
              if (series[nearestSerie].onClick < 0) {
              var previousLevelIndex = currentLevelIndex-1;
              if (previousLevelIndex >= 0) 
              changeState ( {"levelIndex" : previousLevelIndex , "isZoom" : false} );
              else
              console.log ("Error: Cannot access level: "+previousLevelIndex);          
              }  
              else */

              if (series[nearestSerie].onClick > 0) {

                  if (metaData.levels.length > getLevelIndex() + 1) {
                      series[nearestSerie].path.classed("clicked", true);
                      console.log("Clicked serie: " + nearestSerie);

                      var currentKeyPath = getKeyPath();
                      var newKeyPath = currentKeyPath == "" ? nearestSerie : currentKeyPath + "/" + nearestSerie;
                      changeState({ "keyPath": newKeyPath });
                  }
                  else
                      console.log("Error: Cannot access level: " + nextLevelIndex);
              }
          }
      }
      function onMouseOut() {
          var coords = d3.mouse(clippedArea.node());
          if (coords[0] < 0 || coords[0] >= width || coords[1] < 0 || coords[1] >= height)
              for (s in series)
                  series[s].path.classed("mouseover", false);
      }

      ///////////////////////////////
      //
      // TIMER FOR ZOOMING
      //
      ///////////////////////////////

      var zoomTimer = null;
      var zoomTimeout = 300;

      function onZoomTimer() {
          zoomTimer = null;
          changeState( { "isZoom": true } );
      }
      function zoomStart() {
          if (zoomTimer === false)
              return;

          if (zoomTimer)
              clearTimeout(zoomTimer);
          zoomTimer = setTimeout(function () { onZoomTimer(); }, zoomTimeout);
      }


      ///////////////////////////////
      //
      // INIT
      //
      ///////////////////////////////


      //svg init
      var svg = d3.select(this).append("svg:svg")
      .attr("width", totalWidth)
      .attr("height", totalHeight);

      var line = d3.svg.line()
      .x(function (dataRecord) { return scalesTime(dataRecord["date"]); })
      .y(function (dataRecord) { return scalesValue(dataRecord["value"]); })
      .defined(function (dataRecord) {
          var domain = scalesTime.domain();
          return dataRecord["date"] >= domain[0]
               && dataRecord["date"] <= domain[1];
      });


      ////////////////

      svg.append("rect")
      .attr("class", "chartBackground")
      .attr("width", width + "px")
      .attr("height", height + "px")
      .attr("x", appSettings.margin + "px")
      .attr("y", appSettings.margin + "px")
      .on("mousemove", function () { onMouseMove(); })
      .on("click", function () { onClick(); })
      .on("mouseout", function () { onMouseOut(); });

      var svgTitle = svg.append("text")
      .attr("transform", "translate(" + (appSettings.margin) + ",25)")
      .classed("chartTitle", true)
      .text("");

      svg.call(d3.behavior.zoom()
      .x(scalesTime)
      .scaleExtent([0.25, 4])
      .on("zoom", function () {
          redraw(true);
          zoomStart();
      }));

      var svgXaxis = svg.append("g")
      .attr("class", "xaxis axis")
      .attr("transform", "translate(" + appSettings.margin + "," + appSettings.margin + ")");

      var svgYaxis = svg.append("g")
      .attr("class", "yaxis axis")
      .attr("transform", "translate(" + (width + appSettings.margin) + "," + appSettings.margin + ")");

      var clipRect = svg.append("svg:clipPath")
        .attr("id", "clipRect")
        .append("svg:rect")
        .attr("width", width + "px")
        .attr("height", height + "px")
        .attr("x", "0px")
        .attr("y", "0px");

      var clippedArea = svg.append("g")
        .attr("transform", "translate(" + appSettings.margin + "," + appSettings.margin + ")")
        .attr("clip-path", "url(#clipRect)");


      var svgShadedIntervals = new Array();
      for (si = 0; si < metaData.shadedIntervals.length; si++) {
          svgShadedIntervals[si] = clippedArea.append("rect")
        .classed("shadedIntervals", true)
        .style("fill", metaData.shadedIntervals[si].color)
        .attr("y", "0px")
        .attr("height", height + "px")
        .on("mousemove", function () { onMouseMove(); });
      }

      var svgTooltipDot = clippedArea.append("circle")
        .classed("tooltipDot", true)
        .attr("r", 4)
        .style("display", "none")
        .on("mousemove", function () { onMouseMove(); })
        .on("click", function () { onClick(); })
        .on("mouseout", function () { onMouseOut(); });


      var svgTooltipText = clippedArea.append("text")
        .classed("tooltipText", true)
        .on("mousemove", function () { onMouseMove(); })
        .on("click", function () { onClick(); })
        .on("mouseout", function () { onMouseOut(); });

      ///////////////////////////

      xAxis.scale(scalesTime)
      .ticks(metaData.timeAxis.tickCount)
      .tickFormat(metaData.timeAxis.tickFormat)
      .tickSubdivide(metaData.timeAxis.subdivide);
      yAxis.scale(scalesValue)
      .ticks(metaData.valueAxis.tickCount)
      .tickFormat(metaData.valueAxis.tickFormat)
      .tickSubdivide(metaData.valueAxis.subdivide);

      ///////////////////////////


      changeState( { "isInitial" : true } );


  });
    
  return this; //for method chaining
}
  
  
  

