$(document).ready(function() {
	$('#loginform').bind('submit', function(e) {
		
		
		e.preventDefault();
	
		
 		var name = $("input#username").val().toLowerCase();
	
		var reg	 = /^[\w\d]+$/
		if( reg.test(name) && name.length < 10) {
			 $('#loginform').hide();
			  $('#loading').show()

			  App.Player.set('name', name);

			  App.gameStart();


		} else {
			alert("Please enter a valid name. Letters and Numbers.  Maximum 10 characters");
		
		}
	
		return false;
	 
	});
});