
import com.sun.net.httpserver.*;
import home.AccountManager;
import org.mindrot.jbcrypt.BCrypt;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class App {

    static Map<String, AccountManager.Account> sessions = new ConcurrentHashMap<>();

    // Shared helpers
    static boolean post(HttpExchange ex) throws IOException {
        if (ex.getRequestMethod().equals("POST")) return true;
        reply(ex, 405, "Method not allowed.");
        return false;
    }

    static Map<String, String> form(HttpExchange ex) throws IOException {
        Map<String, String> data = new HashMap<>();

        for (String field : new String(ex.getRequestBody().readAllBytes(),
                StandardCharsets.UTF_8).split("&")) {
            String[] parts = field.split("=", 2);
            if (parts.length == 2)
                data.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                         URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
        }

        return data;
    }

    static void reply(HttpExchange ex, int status, String message) throws IOException {
        byte[] body = message.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        ex.sendResponseHeaders(status, body.length);
        try (var out = ex.getResponseBody()) {
            out.write(body);
        }
    }

    static void send(HttpExchange ex, Path file, String type) throws IOException {
        if (!Files.isRegularFile(file)) {
            ex.sendResponseHeaders(404, -1);
            ex.close();
            return;
        }

        byte[] body = Files.readAllBytes(file);
        ex.getResponseHeaders().set("Content-Type", type);
        ex.sendResponseHeaders(200, body.length);
        try (var out = ex.getResponseBody()) {
            out.write(body);
        }
    }

    static void page(HttpServer server, String url, String file) {
        server.createContext(url, ex ->
            send(ex, Path.of(file), "text/html; charset=utf-8"));
    }

    static void staticFiles(HttpServer server, String url, String folder,
                            String extension, String type) {
        server.createContext(url, ex -> {
            String filename = ex.getRequestURI().getPath().substring(url.length());

            if (!filename.matches("[a-zA-Z0-9_-]+\\." + extension)) {
                ex.sendResponseHeaders(400, -1);
                ex.close();
                return;
            }

            send(ex, Path.of(folder).resolve(filename), type);
        });
    }

    // Sessions
    static String sessionToken(HttpExchange ex) {
        String cookie = ex.getRequestHeaders().getFirst("Cookie");
        if (cookie == null) return null;

        for (String part : cookie.split(";")) {
            String[] pair = part.trim().split("=", 2);
            if (pair.length == 2 && pair[0].equals("SESSION"))
                return pair[1];
        }
        return null;
    }

    static void createSession(HttpExchange ex, AccountManager.Account account) {
        String token = UUID.randomUUID().toString();
        sessions.put(token, account);

        ex.getResponseHeaders().add("Set-Cookie",
            "SESSION=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000");
    }

    static String jsonEscape(String value) {
        return value.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r");
    }

    public static void main(String[] args) throws IOException {
        String host = System.getenv().getOrDefault("HOST", "0.0.0.0");
        HttpServer server = HttpServer.create(new InetSocketAddress(host, 5000), 0);

        // Pages
        page(server, "/", "home/home.html");
        page(server, "/Account", "home/account.html");
        page(server, "/User", "frontend/frontend.html");
        page(server, "/Warehouse", "warehouse/warehouse.html");
        page(server, "/Delivery", "delivery/delivery.html");

        // Static files and components
        staticFiles(server, "/css/", "css", "css", "text/css; charset=utf-8");
        staticFiles(server, "/videos/", "videos", "png", "image/png");
        staticFiles(server, "/routes/", "delivery/routes", "geojson", "application/geo+json");
        staticFiles(server, "/components/html/", "components/html", "html", "text/html; charset=utf-8");
        staticFiles(server, "/components/css/", "components/css", "css", "text/css; charset=utf-8");
        staticFiles(server, "/components/js/", "components/js", "js", "text/javascript; charset=utf-8");

        // Registration
        server.createContext("/api/register", ex -> {
            if (!post(ex)) return;

            Map<String, String> f = form(ex);
            String username = f.get("username");
            String email = f.get("email");
            String password = f.get("password");
            String address = f.get("address");
            String eircode = f.get("eircode");
            String phone = f.get("phoneNumber");

            if (username == null || email == null || password == null ||
                address == null || eircode == null || phone == null ||
                username.isBlank() || email.isBlank() || password.isBlank() ||
                address.isBlank() || eircode.isBlank() || phone.isBlank()) {
                reply(ex, 400, "Please complete all fields.");
                return;
            }

            if (AccountManager.accountExists(username)) {
                reply(ex, 409, "Username already exists.");
                return;
            }

            if (AccountManager.emailExists(email)) {
                reply(ex, 409, "Email already registered.");
                return;
            }

            boolean created = AccountManager.createAccount(
                username, email, BCrypt.hashpw(password, BCrypt.gensalt()),
                address, eircode, phone);

            reply(ex, created ? 201 : 500,
                created ? "Account created successfully!" : "Could not create account.");
        });

        // Login
        server.createContext("/api/login", ex -> {
            if (!post(ex)) return;

            Map<String, String> f = form(ex);
            String login = f.get("login");
            String password = f.get("password");

            if (login == null || password == null ||
                login.isBlank() || password.isBlank()) {
                reply(ex, 400, "Enter your username/email and password.");
                return;
            }

            AccountManager.Account account = AccountManager.findAccount(login);

            if (account == null || !BCrypt.checkpw(password, account.passwordHash())) {
                reply(ex, 401, "Incorrect username/email or password.");
                return;
            }

            createSession(ex, account);
            reply(ex, 200, "Login successful.");
        });

        // Current user
        server.createContext("/api/me", ex -> {
            String token = sessionToken(ex);
            AccountManager.Account account = token == null ? null : sessions.get(token);

            String response = account == null
                ? "{\"loggedIn\":false}"
                : "{\"loggedIn\":true,\"username\":\"" +
                    jsonEscape(account.username()) + "\",\"email\":\"" +
                    jsonEscape(account.email()) + "\"}";

            ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            byte[] body = response.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, body.length);
            try (var out = ex.getResponseBody()) {
                out.write(body);
            }
        });

        // Logout
        server.createContext("/api/logout", ex -> {
            if (!post(ex)) return;

            String token = sessionToken(ex);
            if (token != null) sessions.remove(token);

            ex.getResponseHeaders().add("Set-Cookie",
                "SESSION=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");

            reply(ex, 200, "Logged out.");
        });

        server.start();
        System.out.println("Running on http://" + host + ":5000");
    }
}
