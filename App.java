
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;

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

        server.start();
        System.out.println("Running on http://" + host + ":5000");
    }
}