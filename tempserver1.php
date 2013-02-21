<?php

$from = isset( $_GET["timefrom"]) ? $_GET["timefrom"] : "2010-01-01" ;
$to = isset( $_GET["timeto"] ) ? $_GET["timeto"] :      "2011-01-01" ;
$step = isset( $_GET["timestep"] ) ? $_GET["timestep"] : 60*60*24*30 ;
$grouping = isset( $_GET["grouping"] ) ? $_GET["grouping"] : "" ;

$from = strtotime($from);
$to = strtotime($to);

print " {\"industry\":\n";
print "[\n";
$first = true;

$base = ($grouping == "r1") ? 1
       :(($grouping == "r2") ? 2
       :(($grouping == "r3") ? 3 : 0));
       
for ($i = $from; $i <= $to ; $i += $step) {
  for ($c = 0; $c <= 2 ; $c ++) {
   
   $cc = $base + $c*3;
   $v = sin($i / (60*60*24*30*$cc) ) * (30);
    if ($first) {
      $first = false;
    } else
       print ", \n";
   $d = date("Y-m-d", $i);
   
   print "   {\"country\": \"c$cc\", \"date\": \"$d\", \"growth\": $v }";
  
  }
}
print "]\n";
print "\n  }\n";
?>