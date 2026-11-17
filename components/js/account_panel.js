
function initialiseAccountPanel() {

    const loggedOut = document.getElementById("loggedOut");
    const loggedIn = document.getElementById("loggedIn");

    if (!loggedOut || !loggedIn) return;

    async function updateAccount() {
        try {
            const response = await fetch("/api/me");
            const account = await response.json();

            loggedOut.hidden = account.loggedIn;
            loggedIn.hidden = !account.loggedIn;

            if (account.loggedIn) {
                document.getElementById("accountUsername").textContent =
                    account.username;

                document.getElementById("accountEmail").textContent =
                    account.email;
            }

        } catch (error) {
            console.error("Login status error:", error);
        }
    }

    // Login
    document.getElementById("loginForm").addEventListener("submit",
        async event => {
            event.preventDefault();

            const message = document.getElementById("loginMessage");
            const button = event.currentTarget.querySelector("button");

            button.disabled = true;
            message.textContent = "";

            const data = new URLSearchParams({
                login: document.getElementById("loginName").value,
                password: document.getElementById("loginPassword").value
            });

            try {
                const response = await fetch("/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: data
                });

                const result = await response.text();

                if (response.ok) {
                    document.getElementById("loginPassword").value = "";
                    await updateAccount();
                } else {
                    message.textContent = result;
                }

            } catch (error) {
                message.textContent = "Could not connect to server.";
            }

            button.disabled = false;
        }
    );

    // Logout
    document.getElementById("logoutButton").addEventListener("click",
        async () => {
            const response = await fetch("/api/logout", {
                method: "POST"
            });

            if (response.ok) {
                await updateAccount();
            }
        }
    );

    updateAccount();
}
