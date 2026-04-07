try {
    Add-Type -TypeDefinition '
    using System;
    using System.Runtime.InteropServices;
    public class MouseWatcher {
        [DllImport("user32.dll")]
        public static extern short GetAsyncKeyState(int vKey);
    }
    '
}
catch {
    # If Add-Type fails (e.g. security policy), we fallback to assuming mouse is UP
    Write-Host "ERROR: Could not compile Add-Type"
    exit 1
}

$VirtualKey = $args[0]
if (-not $VirtualKey) { $VirtualKey = 1 } # VK_LBUTTON is 1

while ($true) {
    # GetAsyncKeyState returns short. If the most significant bit is set, the key is down.
    $state = [MouseWatcher]::GetAsyncKeyState($VirtualKey)
    if (($state -band 0x8000) -eq 0x8000) {
        Write-Host "DOWN"
    }
    else {
        Write-Host "UP"
    }
    Start-Sleep -Milliseconds 50
}
