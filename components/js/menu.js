
// Load the menu
fetch("/components/html/menu.html")
    .then(response => {
        if (!response.ok) throw new Error("Could not load menu");
        return response.text();
    })
    .then(html => {
        document.body.insertAdjacentHTML("afterbegin", html);

        document.getElementById("menuButton").onclick = toggleMenu;
        document.getElementById("closeMenu").onclick = toggleMenu;

        loadAccountPanel();
    })
    .catch(error => console.error("Menu error:", error));


function toggleMenu() {
    document.getElementById("sidePanel").classList.toggle("open");
}


// Load the shared account panel
async function loadAccountPanel() {
    try {
        // Load account HTML
        const response = await fetch("/components/html/account_panel.html");

        if (!response.ok) {
            throw new Error("Could not load account HTML");
        }

        const html = await response.text();

        document.getElementById("account_panel").innerHTML = html;

        // Load account CSS
        if (!document.getElementById("accountPanelCSS")) {
            const css = document.createElement("link");
            css.id = "accountPanelCSS";
            css.rel = "stylesheet";
            css.href = "/components/css/account_panel.css";
            document.head.appendChild(css);
        }

        // Load account JavaScript
        if (!document.getElementById("accountPanelJS")) {
            const script = document.createElement("script");
            script.id = "accountPanelJS";
            script.src = "/components/js/account_panel.js";

            script.onload = () => {
                if (typeof initialiseAccountPanel === "function") {
                    initialiseAccountPanel();
                }
            };

            document.body.appendChild(script);
        }

    } catch (error) {
        console.error("Account panel error:", error);
    }
}
