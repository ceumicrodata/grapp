  
function cmd_chart(selection, metaData ) {

  var chartTitle = selection.select(".chartTitle");
  var chartDescription = selection.select(".chartDescription");
  var buttonContainer = selection.select(".chartButtons");
 
  selection.select(".chartContainer").each(function() { 

    var series = new Object();
    
    var speed = 500;
    var margin = 20;
    
    var currentLevel = 0;
    var settings = metaData.levels[0]; 
  
    var totalWidth  = $(this).width() ; 
    var totalHeight = $(this).height() ;

    var width  = totalWidth - 2*margin; 
    var height = totalHeight - 2*margin;

    var timeFrom = settings.dateFormat.parse(metaData.dateFrom).getTime();
    var timeTo =   settings.dateFormat.parse(metaData.dateTo).getTime();
    var valueFrom = metaData.valueFrom;
    var valueTo =   metaData.valueTo;
    
    var scalesTime = d3.time.scale()
      .range([0,width])
      .domain([timeFrom,timeTo]);
    var scalesValue = d3.scale.linear()
      .range([height,0])
      .domain([valueFrom,valueTo]);
 
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

    function loadDataAndRedraw(instant, levelUpFromSerie, levelDownToSerie) { 
      
      function queryAndDraw(query) {
        
        var url = query.url(dateFrom, dateTo, settings.grouping);
       
        console.log ("AJAX Query: "+url);
        d3.json(url, function(data) {
            
          var table = data[query.tableName];
          var newSeries = new Object();
          for (var i=0; i<table.length; i++) {
            var key = table[i][query.serieKey];
            if (!series[key]) {
              series[key] = new Array();
              series[key].level = currentLevel;
              console.log ("Serie added:"+key);
  
            }
              
            var date = settings.dateFormat.parse( table[i][query.dateKey] ).getTime();
            var value = table[i][query.valueKey];
            
            var foundExisting = false;
            for (d in series[key]) 
              if (series[key][d].date == date) {
                series[key][d].value = value;
                foundExisting = true;
                break;
              }
            if (!foundExisting)
              series[key].push( { "date" : date, "value": value } );
          }
           
          for ( s in series ) {
            series[s].sort(function(a,b) { return a.date - b.date; } );
            if (!series[s].path) {
  
              series[s].path = clippedArea.append("svg:path")
                                  .attr("d", line(series[levelUpFromSerie ? levelUpFromSerie : s]))
                                  .style("stroke", d3.rgb(255,255,255).toString());
                             
              series[s].color = query.color ? query.color : d3.hsl(Math.random()*360, 1, 0.5).toString();            
              
              series[s].path.on("mouseover", function() {
                  var coords = d3.mouse(this);
                  var timex = scalesTime.invert(coords[0]);
                  var valuey = scalesValue.invert(coords[1]);
                  var datex = settings.dateFormat(timex);
                  
                  for ( ss in series ) 
                    if (series[ss].path.node() == this)
                       svgInfo.text(ss+" ("+datex+": "+valuey+")");
                  d3.select(this).classed("mouseover", true);
              }).on("mouseout", function() {
                  svgInfo.text("");
                  d3.select(this).classed("mouseover", false);
              });
              
              series[s].path.on("click", function() {
              
                if (currentLevel > 0)
                  loadDataAndRedraw(false,null,settings.grouping);
                else {
                  var clickedSerie = null;
                  for ( ss in series ) 
                    if (series[ss].path.node() == this) 
                      clickedSerie = ss;
                      
                  
                  if (clickedSerie) {
                    series[clickedSerie].path.classed("clicked", true);
                    console.log ("Clicked serie: "+clickedSerie);
  
                    loadDataAndRedraw(false,clickedSerie);
                  }
                }
                             
              });
              
            }
          }   
                   
          redraw(instant);
          
          if (zoomTimer)
            clearTimeout(zoomTimer);
          zoomTimer = null;
  
        });
      }
      
      ///////////////////
      
      zoomTimer = false;
      
      if (levelUpFromSerie) {
        currentLevel ++;
        settings = metaData.levels[currentLevel]; 
        settings.grouping = levelUpFromSerie;
      }
      else if (levelDownToSerie) {
        currentLevel --;
        settings = metaData.levels[currentLevel]; 
      }  
         
      var timeDomain = scalesTime.domain();
      var dateFrom = settings.dateFormat(new Date(timeDomain[0]));
      var dateTo =   settings.dateFormat(new Date(timeDomain[1]));
      
      for (q=0; q<1 /*settings.queries.length*/; q++) {
        queryAndDraw(settings.queries[q], dateFrom, dateTo );
      }
    }
    
    function redraw(instant) {

      if (instant) 
      {
        for ( s in series ) 
          series[s].path.attr("d", line(series[s]));
      }
      else {
        for ( s in series ) {
          if (series[s].level == currentLevel)
            series[s].path.classed("clicked", false).transition()
              .duration(speed)
              .attr("d", line(series[s]))
              .style("stroke", series[s].color );
          else if (series[s].level < currentLevel)
            series[s].path.transition()
              .duration(speed)
              .attr("d", line(series[s]))
              .style("stroke", d3.rgb(240,240,240).toString());   
          else if (series[s].level > currentLevel) {
            series[s].path.transition()
              .duration(speed)
              .attr("d", line(series[metaData.levels[currentLevel+1].grouping]))
              .remove();
              
            delete series[s];
          }
        }
      }
        
      if (instant) {
        svgXaxis.call(xAxis);
        svgYaxis.call(yAxis);
      }
      else {      
        svgXaxis.transition().duration(speed).call(xAxis);
        svgYaxis.transition().duration(speed).call(yAxis);
        
        chartTitle.text(settings.title);
        chartDescription.text(settings.description);
      }
    }
    
    ///////////////////////////////
    //
    // TIMER FOR ZOOMING
    //
    ///////////////////////////////
    
    var zoomTimer = null;
    var zoomTimeout = 300;
    
    function onZoomTimer() {
      console.log("onZoomTimer");
      zoomTimer = null;
      loadDataAndRedraw(true);
    }
    function zoomStart() {
      if (zoomTimer === false)
        return;
    
      if (zoomTimer)
        clearTimeout(zoomTimer);
      zoomTimer = setTimeout(function(){ onZoomTimer(); },zoomTimeout);
    } 
               
    ///////////////////////////////
    //
    // INIT
    //
    ///////////////////////////////
  
 
    //svg init
    var svg = d3.select(this).append("svg:svg")
      .attr("width", totalWidth)
      .attr("height",totalHeight);
    
    var line = d3.svg.line()
      .x(function(dataRecord) { return margin + scalesTime(dataRecord["date"]); })
      .y(function(dataRecord) { return margin + scalesValue(dataRecord["value"]);});  

       
    ////////////////
    
    svg.append("rect")
      .attr("class", "chartBackground")
      .attr("width", width + "px")
      .attr("height", height + "px")
      .attr("x", margin + "px")
      .attr("y", margin + "px");
      
    svg.call(d3.behavior.zoom()
      .x(scalesTime)
     // .y(scalesValue)
      .scaleExtent([0.25, 4])
      .on("zoom", function() { 
        redraw(true);
        zoomStart();
      }));
      
    var svgXaxis = svg.append("g")
      .attr("class", "xaxis axis")
      .attr("transform", "translate("+margin+"," + margin + ")");

    var svgYaxis = svg.append("g")
      .attr("class", "yaxis axis")
      .attr("transform", "translate("+(width + margin)+","+ margin +")");
      
    var clipRect = svg.append("svg:clipPath")
        .attr("id", "clipRect")
        .append("svg:rect")
        .attr("width", width + "px")
        .attr("height", height + "px")
        .attr("x", margin + "px")
        .attr("y", margin + "px");
        
    var clippedArea = svg.append("g")
        .attr("clip-path", "url(#clipRect)");
          
    
    var svgInfo = svg.append("text")
      .attr("transform", "translate(" + (width + margin) + ",0)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("");

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

    loadDataAndRedraw(false);

  });
    
  return this; //for method chaining
}
  
  
  

