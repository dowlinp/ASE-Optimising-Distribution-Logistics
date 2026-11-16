package home;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class AccountManager {
    private static final String URL = System.getenv("ORACLE_URL");
    private static final String USER = System.getenv("ORACLE_USER");
    private static final String PASSWORD = System.getenv("ORACLE_PASSWORD");

    private static Connection connect() throws SQLException {
        return DriverManager.getConnection(URL, USER, PASSWORD);
    }

    public static boolean createAccount(String username, String email, String passwordHash, String Address,
            String Eircode, String PhoneNumber) {
        String sql = """
                INSERT INTO ACCOUNTS (USERNAME, EMAIL, PASSWORD_HASH, ADDRESS, EIRCODE, PHONE_NUMBER)
                VALUES (?, ?, ?, ?, ?, ?)
                """;
        try (Connection conn = connect(); PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, username);
            stmt.setString(2, email);
            stmt.setString(3, passwordHash);
            stmt.setString(4, Address);
            stmt.setString(5, Eircode);
            stmt.setString(6, PhoneNumber);

            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }

    }

    public static boolean accountExists(String username) {

        String sql = "SELECT COUNT(*) FROM ACCOUNTS WHERE USERNAME = ?";

        try (Connection conn = connect();
                PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, username);

            try (ResultSet result = stmt.executeQuery()) {
                return result.next() && result.getInt(1) > 0;
            }

        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static boolean emailExists(String email) {

        String sql = "SELECT COUNT(*) FROM ACCOUNTS WHERE EMAIL = ?";

        try (Connection conn = connect(); PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, email);

            try (ResultSet result = stmt.executeQuery()) {
                return result.next() && result.getInt(1) > 0;
            }

        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

}
