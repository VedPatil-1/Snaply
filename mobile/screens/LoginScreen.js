import React, { useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { api, setAuthToken } from "../services/api";

export default function LoginScreen({ navigation, onLoggedIn }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async () => {
        setError("");

        if (!email.trim()) {
            setError("Please enter your email.");
            return;
        }

        if (!password) {
            setError("Please enter your password.");
            return;
        }

        try {
            setLoading(true);

            const response = await api.post("/auth/login", {
                email: email.trim(),
                password,
            });

            await setAuthToken(response.token);

            if (onLoggedIn) {
                onLoggedIn(response.user);
            }
        } catch (err) {
            console.error("Login error:", err);

            setError(
                err?.message ||
                "Login failed. Please check your email and password."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <Text style={styles.logo}>Snaply</Text>

                        <Text style={styles.title}>
                            Welcome back
                        </Text>

                        <Text style={styles.subtitle}>
                            Log in to continue to Snaply.
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#999"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#999"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                        />

                        {error ? (
                            <Text style={styles.error}>
                                {error}
                            </Text>
                        ) : null}

                        <TouchableOpacity
                            style={[
                                styles.loginButton,
                                loading && styles.disabledButton,
                            ]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>
                                    Log In
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.registerRow}>
                        <Text style={styles.registerText}>
                            Don't have an account?
                        </Text>

                        <TouchableOpacity
                            onPress={() =>
                                navigation.navigate("Register")
                            }
                        >
                            <Text style={styles.registerLink}>
                                Create account
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#fff",
    },

    keyboardView: {
        flex: 1,
    },

    container: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 28,
        paddingVertical: 40,
    },

    header: {
        alignItems: "center",
        marginBottom: 36,
    },

    logo: {
        fontSize: 38,
        fontWeight: "800",
        color: "#000",
        marginBottom: 20,
    },

    title: {
        fontSize: 26,
        fontWeight: "700",
        color: "#111",
        textAlign: "center",
    },

    subtitle: {
        marginTop: 8,
        fontSize: 15,
        color: "#777",
        textAlign: "center",
    },

    form: {
        width: "100%",
    },

    input: {
        height: 52,
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: "#111",
        marginBottom: 14,
        backgroundColor: "#fafafa",
    },

    error: {
        color: "#e53935",
        fontSize: 14,
        marginBottom: 14,
    },

    loginButton: {
        height: 52,
        borderRadius: 12,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
    },

    disabledButton: {
        opacity: 0.6,
    },

    loginButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },

    registerRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 28,
    },

    registerText: {
        color: "#777",
        fontSize: 14,
    },

    registerLink: {
        color: "#000",
        fontSize: 14,
        fontWeight: "700",
        marginLeft: 5,
    },
});