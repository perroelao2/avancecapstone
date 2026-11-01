
/*Boton Kangreburger*/ 
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const menu = document.getElementById('menu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('active');
    });
  }
});

  

/*Movimiento carrusel*/
  
document.addEventListener('DOMContentLoaded', () => {
    const carrusel = document.getElementById('carrusel');
    let autoScroll;

    function iniciarScroll() {
        autoScroll = setInterval(() => {
            carrusel.scrollBy({ left: 320, behavior: 'smooth' });
        }, 3000);
    }

    function detenerScroll() {
        clearInterval(autoScroll);
    }

    if (carrusel) {
        iniciarScroll();

        carrusel.addEventListener('mouseenter', detenerScroll);
        carrusel.addEventListener('mouseleave', iniciarScroll);
    }
});

/*Flechas de carrusel*/
document.addEventListener('DOMContentLoaded', () => {
    const carrusel = document.getElementById('carrusel');
    const btnIzq = document.getElementById('flecha-izq');
    const btnDer = document.getElementById('flecha-der');
    let autoScroll;

    function iniciarScroll() {
        autoScroll = setInterval(() => {
            carrusel.scrollBy({ left: 320, behavior: 'smooth' });
        }, 3000);
    }

    function detenerScroll() {
        clearInterval(autoScroll);
    }

    if (carrusel) {
        iniciarScroll();

        carrusel.addEventListener('mouseenter', detenerScroll);
        carrusel.addEventListener('mouseleave', iniciarScroll);

        btnIzq.addEventListener('click', () => {
            carrusel.scrollBy({ left: -320, behavior: 'smooth' });
        });

        btnDer.addEventListener('click', () => {
            carrusel.scrollBy({ left: 320, behavior: 'smooth' });
        });
    }
});

/*fechas de reservas*/
function validarFechas() {
  const inicioInput = document.getElementById('fecha_inicio');
  const finInput = document.getElementById('fecha_fin');

  const inicio = inicioInput.value;
  const fin = finInput.value;
  const hoy = new Date().toISOString().split('T')[0];

  if (inicio && inicio < hoy) {
    alert("La fecha de entrada no puede ser menor que hoy.");
    inicioInput.value = "";
    return;
  }

  if (inicio && fin && fin < inicio) {
    alert("La fecha de salida no puede ser menor que la de entrada.");
    finInput.value = "";
  }
}

/*comentarios*/
let indiceCarrusel = 0;

function moverCarrusel(direccion) {
  const carrusel = document.getElementById('carrusel-inner');
  const totalSlides = carrusel.children.length;

  indiceCarrusel += direccion;

  if (indiceCarrusel < 0) indiceCarrusel = totalSlides - 1;
  if (indiceCarrusel >= totalSlides) indiceCarrusel = 0;

  carrusel.style.transform = `translateX(-${indiceCarrusel * 100}%)`;
}


/*carrusel de clientes*/
function moverCarrusel(direccion) {
  const carrusel = document.getElementById("carrusel");
  if (!carrusel) return;

  const item = carrusel.querySelector(".carrusel-item");
  if (!item) return;

  const anchoItem = item.offsetWidth + 20; // 20px margen entre items
  carrusel.scrollBy({
    left: direccion * anchoItem,
    behavior: "smooth",
  });
}