  
function cmd_chart(selection, settings0, settings1 ) {

  selection.each(function() { 

    var series = new Object();
    var speed = 500;
    
    var currentLevel = 0;
    var settings = settings0;

    var timeFrom = settings.dateFormat.parse(settings.dateFrom).getTime();
    var timeTo =   settings.dateFormat.parse(settings.dateTo).getTime();
  
    var width  = $(this).width(); 
    var height = $(this).height();

    function getTimeScale() {
      return d3.time.scale()
        .domain([timeFrom,timeTo])
        .range([0,width]);
    }
    function getValueScale() {
      return d3.scale.linear()
        .domain([settings.valueFrom,settings.valueTo])
        .range([height,0]);
    }    
    
    var scalesTime = getTimeScale();
    var scalesValue = getValueScale();
 
    var xAxis = d3.svg.axis()
    .scale(scalesTime)
    .orient("top");

    var yAxis = d3.svg.axis()
    .scale(scalesValue)
    .orient("right");
    
    ////////////////
    
    function loadDataAndRedraw(from, to, levelUpFromSerie, levelDownToSerie) { 
      
      if (levelUpFromSerie) {
        currentLevel ++;
        settings = settings1; //TODO
        settings.grouping = levelUpFromSerie;
      }
      else if (levelDownToSerie) {
        currentLevel --;
        settings = settings0; //TODO
      }  
    
      var enlargeInterval = (from != null && to != null);
      if (from == null) from = timeFrom;
      if (to == null) to = timeTo;
      
      var dateFrom = settings.dateFormat(new Date(from));
      var dateTo =   settings.dateFormat(new Date(to));
      var query =    settings.query(dateFrom, dateTo, settings.grouping);
     
      console.log ("AJAX Query: "+query);
      d3.json(query, function(data) {
          
        var table = data[settings.tableName];
        var newSeries = new Object();
        for (var i=0; i<table.length; i++) {
          var key = table[i][settings.serieKey];
          if (!series[key]) {
            series[key] = new Array();
            series[key].level = currentLevel;
            console.log ("Serie added:"+key);

          }
            
          var date = settings.dateFormat.parse( table[i][settings.dateKey] ).getTime();
          var value = table[i][settings.valueKey];
          
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

            series[s].path = svg.append("svg:path")
                                .attr("d", line(series[levelUpFromSerie ? levelUpFromSerie : s]))
                                .style("stroke", d3.rgb(255,255,255).toString());
                           
            series[s].color = d3.hsl(Math.random()*360, 1, 0.5).toString();            
            //adding mouseover and mouseout events
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
                loadDataAndRedraw(null,null,null,settings.grouping);
              else {
                var clickedSerie = null;
                for ( ss in series ) 
                  if (series[ss].path.node() == this) 
                    clickedSerie = ss;
                    
                
                if (clickedSerie) {
                  series[clickedSerie].path.classed("clicked", true);
                  console.log ("Clicked serie: "+clickedSerie);

                  loadDataAndRedraw(null,null,clickedSerie);
                }
              }
                           
            });
            
          }
          if (enlargeInterval)
            series[s].path.attr("d", line(series[s]));
        }   
          
        redraw();
      });
    }
    
    function redraw() {
      scalesTime = getTimeScale();
      console.log ("Redraw: "+timeFrom+"-"+timeTo+ "  - level:" + currentLevel+" gr:"+ settings.grouping);
      for ( s in series ) 
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
            .attr("d", line(series[settings1.grouping]))
            .remove();
            
          delete series[s];
            //.each("end",function() { alert(s); delete series[s].path; });
        }
      svgYaxis.call(yAxis);
      
      xAxis.scale(scalesTime);
      svgXaxis.transition().duration(speed).call(xAxis);
      
      svgTitle.text(settings.title);
    }
    ///////////////////////////////////////////////
    
    d3.select("#reload").on("click", function() { 
      loadDataAndRedraw();
    });
    
    d3.select("#fromplus").on("click", function() { 
      timeFrom += 1000*60*60*24*30;
      redraw();
    });
    
    d3.select("#fromminus").on("click", function() { 
      var old = timeFrom;
      timeFrom -= 1000*60*60*24*30;
      loadDataAndRedraw(timeFrom, old);
    });
    
    d3.select("#toplus").on("click", function() { 
      var old = timeTo;
      timeTo += 1000*60*60*24*30;
      loadDataAndRedraw(old, timeTo);
    });
    
    d3.select("#tominus").on("click", function() { 
      timeTo -= 1000*60*60*24*30;
      redraw();
    });
       
    ///////////////////////////////
    //
    // INIT
    //
    ///////////////////////////////
  
 
    //svg init
    var svg = selection.append("svg:svg");
    svg.attr("width", width).attr("height",height);
    
    var line = d3.svg.line()
      .x(function(dataRecord) { return scalesTime(dataRecord["date"]); })
      .y(function(dataRecord) { return scalesValue(dataRecord["value"]);});  

       
    ////////////////
    
    var svgXaxis = svg.append("g")
      .attr("class", "xaxis axis")
      .attr("transform", "translate(0," + height + ")");

    var svgYaxis = svg.append("g")
      .attr("class", "yaxis axis");
    
    var svgTitle = svg.append("text")
      .attr("transform", "translate(" + width + ",0)")

      //.attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text(settings.title);
      
      
     var svgInfo = svg.append("text")
      .attr("transform", "translate(" + width + ",20)")

      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("(move the mouse over a line to see details)");

    ///////////////////////////
    
    loadDataAndRedraw();

  });
    
  return this; //for method chaining
}
  
  
  

