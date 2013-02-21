<?php

$from = isset( $_GET["timefrom"]) ? $_GET["timefrom"] : "2010-01-01" ;
$to = isset( $_GET["timeto"] ) ? $_GET["timeto"] :      "2011-01-01" ;
$step = isset( $_GET["timestep"] ) ? $_GET["timestep"] : 60*60*24*30 ;

$from = strtotime($from);
$to = strtotime($to);

print " {\"industry\":\n";
print "[\n";
$first = true;
for ($i = $from; $i <= $to ; $i += $step) {
  for ($c = 1; $c <= 3 ; $c ++) {
   
   $v = sin($i / (60*60*24*30*$c) )      * (30);
   $v += sin($i / (60*60*24*30*($c+3)) ) * (30);
   $v += sin($i / (60*60*24*30*($c+6)) ) * (30);
   
    if ($first) {
      $first = false;
    } else
       print ", \n";
   $d = date("Y-m-d", $i);
   
   print "   {\"region\": \"r$c\", \"date\": \"$d\", \"growth\": $v }";
  
  }
}
print "]\n";
print "\n  }\n";
?>