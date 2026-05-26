const counters = document.querySelectorAll('.count');

const observer = new IntersectionObserver(entries => {

    entries.forEach(entry => {

        if(entry.isIntersecting){

            const el = entry.target;
            const target = +el.getAttribute('data-target');
            let count = 0;

            const update = () => {

                const increment = target / 100;

                if(count < target){
                    count += increment;
                    el.innerText = Math.floor(count);
                    requestAnimationFrame(update);
                } else {
                    el.innerText = target;
                }

            };

            update();
            observer.unobserve(el);
        }

    });

});

counters.forEach(counter => {
    observer.observe(counter);
});
document.getElementById("year").textContent = new Date().getFullYear();