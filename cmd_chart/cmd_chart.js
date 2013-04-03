function cmd_chart(selection, metaData, appSettings ) {

  var chartDescription = selection.select(".chartDescription");

  function getUrlSearchParams() {
      var pairs = window.location.search.substring(1).split("&"),  obj = {}, pair, i;
      for (i in pairs) {
          pair = pairs[i].split("=");
          if (pair.length == 2) {
            var key = decodeURIComponent(pair[0]);
            var val = decodeURIComponent(pair[1]);
            if (key == "keyPath")
              obj["keyPath"] = val;
            else if (key == "dateFrom")
              obj["timeFrom"] = metaData.dateFormat.parse(val).getTime();
            else if (key == "dateTo")
              obj["timeTo"] = metaData.dateFormat.parse(val).getTime();
          }
      }
      return obj;
  }

  function Intervals() {
      this.ints = new Array();
      this.add = function (from, to) {
          var newInts = new Array();
          var reFrom = from;
          var reTo = to;
          for (var i = 0; i < this.ints.length; i++) {

              var iFrom = this.ints[i][0];
              var iTo = this.ints[i][1];
              if (iFrom > to || from > iTo)
                  newInts.push(ints[i]); //no overlapping
              else {
                  if (reFrom >= iFrom) //subtracting the
                      reFrom = Math.max(reFrom, iTo);
                  if (reTo <= iTo)
                      reTo = Math.min(reTo, iFrom);
 
                  from = Math.min(iFrom, from); //union of the two intervals
                  to = Math.max(iTo, to);
              }
          }
          newInts.push([from, to]);
          this.ints = newInts; 
          return reTo > reFrom ? [reFrom, reTo] : false;
      }
      return this;
  }
  function KeyPathIntervals() {
    this.storage = new Object();
    this.add = function (keyPath, from, to) {
        if (!this.storage[keyPath])
            this.storage[keyPath] = new Intervals();
        return this.storage[keyPath].add(from, to);
    }
  }

  var keyPathIntervals = new KeyPathIntervals();

  selection.select(".chartContainer").each(function () {

      // Prepare HIstory.js
      var previousStateData = null;
      var History = window.History; // Note: We are using a capital H instead of a lower h
      var isHistoryEnabled = History.enabled;
      if (!isHistoryEnabled) {
          console.log("Warning: History.js not supported!");
      }

      var statechangeFired;
      History.Adapter.bind(window, 'statechange', function () {
          var state = History.getState();
          console.log("History state changed: " + state.title);

          loadDataAndRedraw(state.data);
          statechangeFired = true;

      });


      function changeState(stateData) {

          var isInitial = (previousStateData == null);

          if (stateData.keyPath === undefined)
              stateData.keyPath = getKeyPath();
          if (stateData.isZoom === undefined)
              stateData.isZoom = false;

          var timeDomain = scalesTime.domain();

          if (stateData.timeFrom === undefined)
              stateData.timeFrom = timeDomain[0].getTime();
          if (stateData.timeTo === undefined)
              stateData.timeTo = timeDomain[1].getTime();

          var dateFrom = metaData.dateFormat(new Date(stateData.timeFrom));
          var dateTo = metaData.dateFormat(new Date(stateData.timeTo));
          var url = "?keyPath=" + stateData.keyPath + "&dateFrom=" + dateFrom + "&dateTo=" + dateTo;
          var title = "CEU Microdata (testurl: " + url + ")";

          if (isHistoryEnabled) {
              var currentStateData = History.getState().data;
              var currentStateUrl = History.getState().url;
              var doReplace = (previousStateData == null) || (stateData.isZoom && currentStateData.isZoom && stateData.keyPath == currentStateData.keyPath);

              statechangeFired = false;
              if (doReplace)
                  History.replaceState(stateData, title, url);
              else
                  History.pushState(stateData, title, url);

              if (!statechangeFired) {
                  loadDataAndRedraw(stateData); //statechange not fired: the new url ewquals to the old one?
              }
          }
          else {
              loadDataAndRedraw(stateData);
          }

      }

      /////////////////////////////////////

      var expandedKeys = new Array();
      var keyPathCache = "";
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
          return keyPathCache;
          //return expandedKeys.join(keyPathDelimiter);
      }
      function setKeyPath(keyPath) {
          keyPathCache = keyPath;
          expandedKeys = keyPath ? keyPath.split(keyPathDelimiter) : new Array();
      }
      function getLevelIndex() {
          return expandedKeys.length;
      }
      function getLevelIndexOfPath(keyPath) {
          return keyPath ? keyPath.split(keyPathDelimiter).length : 0;
      }

      /////////////////////////////////////

      var series = new Object();

      //var currentLevelIndex = 0;
      var currentLevel = metaData.levels[0];

      var totalWidth = $(this).width();
      var totalHeight = $(this).height();

      var width = totalWidth - 3 * appSettings.margin - appSettings.legendWidth;
      var height = totalHeight - 2 * appSettings.margin;

      var timeMin = metaData.dateFormat.parse(metaData.dateMin).getTime();
      var timeMax = metaData.dateFormat.parse(metaData.dateMax).getTime();

      var scalesTime = d3.time.scale()
      .range([0, width])
      .domain([metaData.dateFormat.parse(metaData.dateFrom), metaData.dateFormat.parse(metaData.dateTo)]);
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

          function updateGraph() {

              var sameKeyPaths = (previousStateData != null) && (stateData.keyPath == previousStateData.keyPath);
              redraw(sameKeyPaths);

              zoomBehavior.zoomTo(scalesTime.domain());
              previousStateData = stateData;

              if (zoomTimer)
                  clearTimeout(zoomTimer);
              zoomTimer = null;
          }

          function queryAndDraw(query) {

              var url = query.url(dateFrom, dateTo, getLastKey());

              console.log("AJAX Query: " + url);
              d3.json(url, function (data) {

                  //loading data
                  var currentKeyPath = getKeyPath();
                  var table = data[query.tableName];
                  var processedSeries = new Object();
                  for (var i = 0; i < table.length; i++) {
                      var ID = table[i][query.serieKey];
                      var key = currentKeyPath == "" ? ID : currentKeyPath + "/" + ID;
                      if (!series[key]) {
                          series[key] = new Array();
                          series[key].ID = ID;
                          series[key].name = "[" + ID + "]"; //TODO
                          series[key].keyPath = currentKeyPath;
                          series[key].onClick = query.onClick;
                          series[key].color = (typeof (query.color) == "function") ? query.color(key) : query.color;
                          series[key].thickness = (typeof (query.thickness) == "function") ? query.thickness(key) : query.thickness;

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

                      processedSeries[key] = true;
                  }

                  //adding path 
                  var lastKey = getLastKey();  //last key: animate from this key
                  if (lastKey && !series[lastKey])
                      lastKey = false;  //not loaded? starting the app on a higher path level
                  for (s in processedSeries) {
                      series[s].sort(function (a, b) { return a.date - b.date; });
                      if (!series[s].path) {

                          var visibleParts = getVisiblePart(series[lastKey ? lastKey : s]);
                          
                          series[s].path = clippedArea.append("svg:path")
                                  .attr("d", line(visibleParts))
                                  .style("stroke-width", series[s].thickness)
                                  .style("stroke", lastKey ? series[lastKey].color : appSettings.chartBackgroundColor);
                      }
                  }

                  if (numOfQueriesToPerform > 1)
                      numOfQueriesToPerform--;
                  else
                      updateGraph();

              });
          }

          ////////////////////////////////////////////////////////////////

          zoomTimer = false;

          var currentKeyPath = getKeyPath();

          if (stateData.keyPath != currentKeyPath) {
              var newLevelIndex = getLevelIndexOfPath(stateData.keyPath);
              if (newLevelIndex < 0 && newLevelIndex >= metaData.levels.length) {
                  console.log("Invalid level: " + newLevelIndex);
                  return;
              } else {
                  setKeyPath(stateData.keyPath);
                  currentLevel = metaData.levels[newLevelIndex];
              }
          }


          scalesTime.domain([new Date(stateData.timeFrom), new Date(stateData.timeTo)]);



              
          var from = stateData.timeFrom;
          var to   = stateData.timeTo;
          
          var expand = (to - from) * appSettings.preloadInvisibleArea; 

          var intervalToLoad = keyPathIntervals.add(getKeyPath(),
            Math.max (timeMin, from - expand),
            Math.min (timeMax, to + expand));

          if (intervalToLoad !== false) {
              var dateFrom = metaData.dateFormat(new Date(intervalToLoad[0]));
              var dateTo = metaData.dateFormat(new Date(intervalToLoad[1]));
              var numOfQueriesToPerform = currentLevel.queries.length;
              for (q = 0; q < currentLevel.queries.length; q++) {
                  queryAndDraw(currentLevel.queries[q], dateFrom, dateTo);
              }
          } else {
              console.log("AJAX Query: SKIPPED (no missing data)");
              updateGraph();
          }
      }

      function getVisiblePart(fullSerie) {
          var domain = scalesTime.domain();
          var d0 = domain[0].getTime();
          var d1 = domain[1].getTime();
          var visiblePart = new Array();
          var lastIndex = fullSerie.length - 1;
          for (var i = 0; i <= lastIndex; i++) {
              if (fullSerie[(i<lastIndex) ? (i+1) : i].date >= d0 && fullSerie[ (i>0) ? (i-1) : i].date <= d1)
                  visiblePart.push(fullSerie[i]);
          }
          return visiblePart;
      } 
      
      function redraw(instant) {

          svgTooltipDot.style("display", "none");
          svgTooltipText.style("display", "none");

          for (s in series)
            series[s].visiblePart = getVisiblePart(series[s]);
  
          if (instant) {
              for (s in series)
                  series[s].path.attr("d", line(series[s].visiblePart));
          }
          else {
              var currentLevelIndex = getLevelIndex();
              var pos = appSettings.legendItemOffset * 2 / 3; //baseline pos

              updateMouseEnabled = false;
              setTimeout(function () {
                  updateMouseEnabled = true;
                  updateMouse();
              }, appSettings.transitionSpeed);

              svgLegend.selectAll("text")
                .transition().duration(appSettings.transitionSpeed / 2)
                .style("opacity", 0)
                .remove();
              svgLegend.selectAll("line")
                .transition().duration(appSettings.transitionSpeed / 2)
                .attr("x2", 0)
                .remove();
              for (s in series) {
                  var levelIndex = getLevelIndexOfPath(series[s].keyPath);
                  if (levelIndex == currentLevelIndex) {
                      series[s].path.classed("clicked", false).transition()
                        .duration(appSettings.transitionSpeed)
                        .attr("d", line(series[s].visiblePart))
                        .style("stroke", series[s].color);
                      series[s].legendText = svgLegend.append("text")
                        .attr("transform", "translate(0," + pos + ")")
                        .text(series[s].name)
                        .style("fill", appSettings.legendTextColor)
                        .style("opacity", 0);
                      series[s].legendText.transition()
                        .delay(appSettings.transitionSpeed / 2)
                        .duration(appSettings.transitionSpeed / 2)
                        .style("opacity", 1);
                      series[s].legendLine = svgLegend.append("line")
                        .attr("x1", 0)
                        .attr("x2", 0)
                        .attr("y1", pos + 7)
                        .attr("y2", pos + 7)
                        .style("stroke", series[s].color)
                        .style("stroke-width", 3);
                      series[s].legendLine.transition()
                        .delay(appSettings.transitionSpeed / 2)
                        .duration(appSettings.transitionSpeed / 2)
                        .attr("x2", appSettings.legendWidth)

                      pos += appSettings.legendItemOffset;
                  }
                  else if (levelIndex < currentLevelIndex)
                      series[s].path.transition()
                      .duration(appSettings.transitionSpeed)
                      .attr("d", line(series[s].visiblePart))
                      .style("stroke", appSettings.lineOnPreviousLevelColor);
                  else if (levelIndex > currentLevelIndex) {
                      series[s].path.transition()
                      .duration(appSettings.transitionSpeed)
                      .attr("d", line(series[getLastKeyOfPath(series[s].keyPath)].visiblePart))
                      .remove();
                      delete series[s];
                  }
              }
              updateMouse();
          }

          for (si = 0; si < metaData.shadedIntervals.length; si++) {
              var timeFrom = metaData.dateFormat.parse(metaData.shadedIntervals[si].dateFrom);
              var timeTo = metaData.dateFormat.parse(metaData.shadedIntervals[si].dateTo);
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
              
              
              var html = svg.node().parentNode.innerHTML;
              downloladSVGbutton.attr("href", "data:image/svg+xml;base64,\n" + btoa(html));
          }
          

      }

      //////////////////////////////////
      //
      // Event handling
      //
      //////////////////////////////////

      function getNearestSerie(tooltipInfo) {
          if (!updateMouseEnabled)
              return false;

          if (lastMouseX < appSettings.margin || lastMouseX >= totalWidth - appSettings.margin || lastMouseY < appSettings.margin || lastMouseY >= totalHeight - appSettings.margin)
              return false;

          var currentKeyPath = getKeyPath();

          if (lastMouseX >= totalWidth - appSettings.margin - appSettings.legendWidth && lastMouseX <= totalWidth - appSettings.margin) {
              var relativeYCoord = lastMouseY - appSettings.margin;
              var pos = appSettings.legendItemOffset;
              for (s in series) {
                  if (series[s].keyPath == currentKeyPath) {
                      if (relativeYCoord < pos)
                          return s;
                      pos += appSettings.legendItemOffset;
                  }
              }
              return false;
          }

          var currentTime = scalesTime.invert(lastMouseX - appSettings.margin).getTime();
          var currentValue = scalesValue.invert(lastMouseY - appSettings.margin);

          var lowestDistance = (metaData.valueMax - metaData.valueMin) * appSettings.lineSenitiveWidth / width;
          var nearestSerie = false;

          for (s in series) {
              if (series[s].keyPath == currentKeyPath) {

                  var pos = -1;
                  for (var i = 0; i < series[s].visiblePart.length; i++) {
                      if (currentTime < series[s].visiblePart[i].date) {
                          pos = i - 1;
                          break;
                      }
                  }
                  if (pos >= 0) {
                      var f = (currentTime - series[s].visiblePart[pos].date) / (series[s].visiblePart[pos + 1].date - series[s].visiblePart[pos].date);
                      var v = series[s].visiblePart[pos].value * (1 - f) + series[s].visiblePart[pos + 1].value * f;

                      var currentDistance = Math.abs(v - currentValue);
                      if (currentDistance < lowestDistance) {
                          lowestDistance = currentDistance;
                          nearestSerie = s;

                          if (tooltipInfo) {
                              tooltipInfo.tooltipDate = (f > 0.5) ? series[s].visiblePart[pos + 1].date : series[s].visiblePart[pos].date;
                              tooltipInfo.tooltipValue = (f > 0.5) ? series[s].visiblePart[pos + 1].value : series[s].visiblePart[pos].value;
                          }
                      }
                  }
              }
          }
          return nearestSerie;
      }
      var lastMouseX = -1;
      var lastMouseY = -1;
      var updateMouseEnabled = true;

      function onMouseMove() {
          var coords = d3.mouse(svg.node());
          lastMouseX = coords[0];
          lastMouseY = coords[1];
          updateMouse();
      }
      function updateMouse() {
          if (zoomTimer !== null)
              return;
          var tooltipInfo = new Object();
          var nearestSerie = getNearestSerie(tooltipInfo);
          var currentKeyPath = getKeyPath();

          for (s in series) {
              if (series[s].keyPath == currentKeyPath) {
                  var hidden = nearestSerie && (s != nearestSerie);
                  series[s].path.style("stroke", hidden ? appSettings.hiddenLineColor : series[s].color);
                  series[s].legendLine.style("stroke", hidden ? appSettings.hiddenLineColor : series[s].color);
                  series[s].legendText.style("fill", hidden ? appSettings.hiddenLineColor : appSettings.legendTextColor);
              }
          }
          if (nearestSerie) //brings selected line to front
              clippedArea.node().appendChild(series[nearestSerie].path.node());

          if (nearestSerie && tooltipInfo.tooltipDate && tooltipInfo.tooltipValue) {

              var px = scalesTime(tooltipInfo.tooltipDate);
              var py = scalesValue(tooltipInfo.tooltipValue);
              svgTooltipDot.style("display", "block")
                  .attr("cx", px + "px")
                  .attr("cy", py + "px")
                  .style("stroke", series[nearestSerie].color)
                  .style("fill", series[nearestSerie].color);

              svgTooltipText.text(metaData.tooltipText(series[nearestSerie].name, tooltipInfo.tooltipDate, tooltipInfo.tooltipValue))
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

              if (series[nearestSerie].onClick > 0) {

                  if (metaData.levels.length > getLevelIndex() + 1) {
                      series[nearestSerie].path.classed("clicked", true);
                      console.log("Clicked serie: " + nearestSerie);

                      var currentKeyPath = getKeyPath();
                      var newKeyPath = nearestSerie;
                      changeState({ "keyPath": newKeyPath });
                  }
                  else
                      console.log("Error: Cannot access level: " + nextLevelIndex);
              }
          } else {

              if (getLevelIndex() > 0) {
                  console.log("Clicked empty area: returning to the previous level.");
                  
                  keyPathIntervals.storage[getKeyPath()] = undefined; //TODO

                  var newKeyPath = getKeyPath().split(keyPathDelimiter, getLevelIndex() - 1).join(keyPathDelimiter);
                  changeState({ "keyPath": newKeyPath });
              }

          }
      }
      function onMouseOut() {
          var coords = d3.mouse(svg.node());
          if (coords[0] < 0 || coords[0] >= totalWidth || coords[1] < 0 || coords[1] >= totalHeight)
              onMouseMove();
      }

      ///////////////////////////////
      //
      // ZOOMING
      //
      ///////////////////////////////

      var zoomBehavior = d3.behavior.zoom()
      .scaleExtent([0.25, 4])
      .on("zoom", function () {

          var currentTranslate = zoomBehavior.translate();
          var currentScale = zoomBehavior.scale();

          var isPan = (currentScale == zoomBehavior.previousScale);

          scalesTime.domain(zoomBehavior.originalScale.range()
            .map(function (x) { return (x - currentTranslate[0]) / currentScale; })
            .map(zoomBehavior.originalScale.invert));

          var timeDomain = scalesTime.domain();
          var restricted = false;
          if (timeDomain[0] < timeMin) {
              if (isPan)
                  timeDomain[1] = timeMin + (timeDomain[1] - timeDomain[0]);
              if (timeDomain[1] > timeMax)
                  timeDomain[1] = timeMax;
              timeDomain[0] = timeMin;
              restricted = true;
          }
          if (timeDomain[1] > timeMax) {
              if (isPan)
                  timeDomain[0] = timeMax - (timeDomain[1] - timeDomain[0]);
              if (timeDomain[0] < timeMin)
                  timeDomain[0] = timeMin;
              timeDomain[1] = timeMax;
              restricted = true;
          }
          if (restricted) {
              scalesTime.domain(timeDomain);
              zoomBehavior.zoomTo(timeDomain);
          }

          redraw(true);
          zoomStart();

          zoomBehavior.previousTranslate = zoomBehavior.translate();
          zoomBehavior.previousScale = zoomBehavior.scale();
      });
      zoomBehavior.zoomTo = function (scaleDomain) {
          var tRange = scaleDomain.map(this.originalScale);
          var tOriginalRange = this.originalScale.range();
          var tScale = (tOriginalRange[1] - tOriginalRange[0]) / (tRange[1] - tRange[0])
          var tTranslate = tOriginalRange[0] - tRange[0] * tScale;

          this.scale(tScale);
          this.translate([tTranslate, 0]);
      };
      zoomBehavior.previousTranslate = zoomBehavior.translate();
      zoomBehavior.previousScale = zoomBehavior.scale();
      zoomBehavior.originalScale = scalesTime.copy();

      /////////////

      var zoomTimer = null;
      var zoomTimeout = 300;

      function onZoomTimer() {
          zoomTimer = null;
          changeState({ "isZoom": true });
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


      var svg = d3.select(this).append("svg:svg")
      .attr("width", totalWidth)
      .attr("height", totalHeight)
      .attr("version", 1.1)
      .attr("xmlns", "http://www.w3.org/2000/svg")
      .on("mousemove", function () { onMouseMove(); })
      .on("click", function () { onClick(); })
      .on("mouseout", function () { onMouseOut(); });
      
      var downloladSVGbutton = d3.select("chartShareButtons").append("a")
          .attr("title", "file.svg")
          .attr("href-lang", "image/svg+xml")
          .attr("href", "data:image/svg+xml;base64,\n" + btoa(html))
          .text("Download SVG");
      
      var line = d3.svg.line()
      .x(function (dataRecord) { return scalesTime(dataRecord["date"]); })
      .y(function (dataRecord) { return scalesValue(dataRecord["value"]); });

      ////////////////

      svg.append("rect")
      .attr("class", "chartBackground")
      .attr("width", width + "px")
      .attr("height", height + "px")
      .attr("x", appSettings.margin + "px")
      .attr("y", appSettings.margin + "px");

      var svgLegend = svg.append("g")
      .attr("transform", "translate(" + (appSettings.margin * 2 + width) + "," + (appSettings.margin) + ")");

      var svgTitle = svg.append("text")
      .attr("transform", "translate(" + (appSettings.margin) + ",25)")
      .classed("chartTitle", true)
      .text("");

      svg.call(zoomBehavior);

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
        .attr("height", height + "px");
      }

      var svgTooltipDot = clippedArea.append("circle")
        .classed("tooltipDot", true)
        .attr("r", 4)
        .style("display", "none");

      var svgTooltipText = clippedArea.append("text")
        .classed("tooltipText", true);

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

      changeState(getUrlSearchParams());

  });
}
