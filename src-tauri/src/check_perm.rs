pub fn check_accessibility() -> bool {
    #[cfg(target_os = "macos")]
    {
        extern "C" {
            pub fn AXIsProcessTrusted() -> bool;
        }
        unsafe { AXIsProcessTrusted() }
    }
    #[cfg(not(target_os = "macos"))]
    true
}
