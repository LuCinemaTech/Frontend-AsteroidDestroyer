import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../config/supabase";
import {
  GW, GH, OX, OY, SPACE_BG, MAIN_MENU_BG,
} from "./game/_shared/constants";

export default function SignIn() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isDev, setIsDev] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showMessage = (title: string, msg: string, type: "success" | "error" = "error") => {
    setMessage({ text: msg, type });
    if (Platform.OS !== "web") {
      Alert.alert(title, msg);
    }
  };

  const handleEmailAuth = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    setMessage(null);
    if (!trimmedEmail || !password) {
      showMessage("Error", "Please fill in email and password.");
      return;
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        showMessage("Error", "Passwords do not match.");
        return;
      }
      if (!username) {
        showMessage("Error", "Please enter a username.");
        return;
      }

      setLoading(true);
      try {
        console.log("Attempting sign up with:", trimmedEmail, username);
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: { username, is_dev: isDev },
          },
        });
        setLoading(false);
        console.log("Sign up response:", JSON.stringify({ data, error }, null, 2));

        if (error) {
          showMessage("Sign Up Error", error.message);
        } else if (data?.user?.identities?.length === 0) {
          showMessage("Error", "An account with this email already exists.");
        } else {
          showMessage("Success", "Account created! Check your email to confirm.", "success");
        }
      } catch (e: any) {
        setLoading(false);
        showMessage("Error", e.message || "Something went wrong.");
      }
    } else {
      setLoading(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        setLoading(false);

        if (error) {
          showMessage("Sign In Error", error.message);
        } else {
          router.back();
        }
      } catch (e: any) {
        setLoading(false);
        showMessage("Error", e.message || "Something went wrong.");
      }
    }
  };

  const handleOAuth = async (provider: "facebook" | "google") => {
    const redirectTo = Linking.createURL("/signin");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      showMessage("Error", error.message);
      return;
    }
    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          router.back();
        }
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <RNStatusBar hidden />
      <View
        style={{
          position: "absolute", left: OX, top: OY,
          width: GW, height: GH, overflow: "hidden",
        }}
      >
        <Image
          source={SPACE_BG}
          style={{ position: "absolute", width: GW, height: GH }}
          resizeMode="cover"
        />
        <Image
          source={MAIN_MENU_BG}
          style={{ position: "absolute", width: GW, height: GH }}
          resizeMode="cover"
        />

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 28,
            paddingVertical: 40,
          }}
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}
          >
            <Feather name="arrow-left" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Message banner */}
          {message && (
            <View
              style={{
                backgroundColor: message.type === "success" ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)",
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 16,
                marginTop: 40,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, textAlign: "center", fontWeight: "600" }}>
                {message.text}
              </Text>
            </View>
          )}

          {/* Title */}
          <Text
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: 32,
              letterSpacing: 2,
            }}
          >
            {isSignUp ? "SIGN UP" : "SIGN IN"}
          </Text>

          {/* OAuth buttons */}
          <TouchableOpacity
            onPress={() => handleOAuth("facebook")}
            style={{
              backgroundColor: "#1877F2",
              borderRadius: 8,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
              Continue with Facebook
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleOAuth("google")}
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <Text style={{ color: "#333", fontSize: 16, fontWeight: "600" }}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <Text style={{ color: "rgba(255,255,255,0.5)", marginHorizontal: 12, fontSize: 13 }}>
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
          </View>

          {/* Username (sign up only) */}
          {isSignUp && (
            <TextInput
              placeholder="Username"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: "#fff",
                fontSize: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}
            />
          )}

          {/* Email */}
          <TextInput
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 14,
              color: "#fff",
              fontSize: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          />

          {/* Password */}
          <TextInput
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 8,
              paddingHorizontal: 16,
              paddingVertical: 14,
              color: "#fff",
              fontSize: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          />

          {/* Confirm Password (sign up only) */}
          {isSignUp && (
            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: "#fff",
                fontSize: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}
            />
          )}

          {/* Dev checkbox (sign up only) */}
          {isSignUp && (
            <TouchableOpacity
              onPress={() => setIsDev(!isDev)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 20,
                paddingVertical: 4,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: isDev ? "#4ade80" : "rgba(255,255,255,0.3)",
                  backgroundColor: isDev ? "#4ade80" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                {isDev && <Feather name="check" size={14} color="#000" />}
              </View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                Dev Account
              </Text>
            </TouchableOpacity>
          )}

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleEmailAuth}
            disabled={loading}
            style={{
              backgroundColor: "#6366f1",
              borderRadius: 8,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 20,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                {isSignUp ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle sign in / sign up */}
          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
            <Text style={{ color: "rgba(255,255,255,0.6)", textAlign: "center", fontSize: 14 }}>
              {isSignUp
                ? "Already have an account? Sign In"
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}
