function encode_as_img_and_link(svgContent, buttonDiv){
 // Add some critical information
 $("svg").attr({ version: '1.1' , xmlns:"http://www.w3.org/2000/svg"});

 var b64 = Base64.encode(svgContent);

 // Works in recent Webkit(Chrome)
 $(buttonDiv).append($("<img src='data:image/svg+xml;base64,\n"+b64+"' alt='file.svg'/>"));

 // Works in Firefox 3.6 and Webit and possibly any browser which supports the data-uri
 $(buttonDiv).append($("<a href-lang='image/svg+xml' href='data:image/svg+xml;base64,\n"+b64+"' title='file.svg'>Download</a>"));
}