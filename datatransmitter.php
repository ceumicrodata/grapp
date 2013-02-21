<?php

$timefrom = $_GET["timefrom"];
$timeto = $_GET["timeto"];
print  file_get_contents("http://htsql.coauthors.net/htsql/industry?date>='$timefrom'&date<='$timeto'/:json");

?>