cask "nyx-vox" do
  version "1.5.1"
  sha256 "65a2fe28d567f2836812f1ac487f3d60a479e7d52166542692800b6fd8d1bb32"

  url "https://github.com/AVP-Dev/nyx-vox/releases/download/v#{version}/NYX.Vox_#{version}_aarch64.dmg"
  name "NYX Vox"
  desc "AI-assisted voice dictation"
  homepage "https://github.com/AVP-Dev/nyx-vox"

  depends_on arch: :arm64

  app "NYX Vox.app"

  postflight do
    bundle = appdir/"NYX Vox.app"
    attributes = system_command "/usr/bin/xattr", args: [bundle]
    if attributes.stdout.lines.map(&:strip).include?("com.apple.quarantine")
      system_command "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", bundle]
    end
    system_command "/usr/bin/open", args: ["-a", bundle]
  end
end
