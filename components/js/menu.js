
fetch("/components/html/menu.html")
    .then(response => response.text())
    .then(html => {
        document.body.insertAdjacentHTML("afterbegin", html);

        document.getElementById("menuButton").onclick = toggleMenu;
        document.getElementById("closeMenu").onclick = toggleMenu;
    });

function toggleMenu() {
    document.getElementById("sidePanel").classList.toggle("open");
}
