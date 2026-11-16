
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;

import home.AccountManager;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.mindrot.jbcrypt.BCrypt;

public class App {

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
        server.createContext(url, ex -> send(ex, Path.of(file), "text/html; charset=utf-8"));
    }

    static void staticFiles(HttpServer server, String url, String folder,
            String extension, String type) {
        server.createContext(url, ex -> {
            String filename = ex.getRequestURI().getPath()
                    .substring(url.length());

            if (!filename.matches("[a-zA-Z0-9_-]+\\." + extension)) {
                ex.sendResponseHeaders(400, -1);
                ex.close();
                return;
            }

            send(ex, Path.of(folder).resolve(filename), type);
        });
    }

    static void reply(HttpExchange ex, int status, String message) throws IOException {
        byte[] body = message.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        ex.sendResponseHeaders(status, body.length);
        ex.getResponseBody().write(body);
        ex.close();
    }

    public static void main(String[] args) throws IOException {
        String host = System.getenv().getOrDefault("HOST", "0.0.0.0");
        HttpServer server = HttpServer.create(new InetSocketAddress(host, 5000), 0);

        // HTML pages
        page(server, "/", "home/home.html");
        page(server, "/Account", "home/account.html");
        page(server, "/User", "frontend/frontend.html");
        page(server, "/Warehouse", "warehouse/warehouse.html");
        page(server, "/Delivery", "delivery/delivery.html");

        // Static files
        staticFiles(server, "/css/", "css", "css", "text/css; charset=utf-8");
        staticFiles(server, "/videos/", "videos", "png", "image/png");
        staticFiles(server, "/routes/", "delivery/routes", "geojson",
                "application/geo+json");

        // Components
        staticFiles(server, "/components/html/", "components", "html",
                "text/html");
        staticFiles(server, "/components/css/", "components", "css",
                "text/css");
        staticFiles(server, "/components/js/", "components", "js",
                "text/javascript");

        server.createContext("/api/register", ex -> {
            if (!ex.getRequestMethod().equals("POST")) {
                ex.sendResponseHeaders(405, -1);
                ex.close();
                return;
            }

            Map<String, String> form = new HashMap<>();

            for (String field : new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8).split("&")) {
                String[] parts = field.split("=", 2);
                if (parts.length == 2)
                    form.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                            URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
            }

            String username = form.get("username");
            String email = form.get("email");
            String password = form.get("password");
            String address = form.get("address");
            String eircode = form.get("eircode");
            String phone = form.get("phoneNumber");

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

        server.start();
        System.out.println("Running on http://" + host + ":5000");
    }
}
