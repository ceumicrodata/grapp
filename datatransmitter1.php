<?php

$dateFrom = $_GET["dateFrom"];
$dateTo = $_GET["dateTo"];
$q = "http://htsql.coauthors.net/htsql/growth?".urlencode("date>='$dateFrom'&date<='$dateTo'&region='periphery'/:json");
//print $q;
print file_get_contents($q);

?>