$(window).scroll(function() {
    var scroll = $(window).scrollTop();
    if (scroll >= 200) {
        $(".navbar").addClass("navBg");
    } else {
        $(".navbar").removeClass("navBg");
    }
});

$('.fancybox').click(function(e) {
    e.preventDefault();
    $
})

$('.fancybox').click(function(e) {

    $('body, html').animate({

        scrollTop: $('.about, .join').offset().top - $('.navbar').innerHeight()
    }, 500);

});


$(document).ready(function() {
    $(".navbar-nav .nav-item .nav-link, .dropdown-item").click(function(e) {
        //$(this).parent().addClass("act").siblings().removeClass("act");
        $("body, html").animate({
                // scrollTop = divId.offset().top
                scrollTop: $("#" + $(this).data("target")).offset().top - 100

            },
            800
        );
    });

    $(".navbar-nav .nav-item .nav-link, .dropdown-item").click(function() {
        $(".navbar-collapse").removeClass("show");
    })


    $('.show_coupon').on('click', function(){
        $('.coupon').slideToggle()
    })
})