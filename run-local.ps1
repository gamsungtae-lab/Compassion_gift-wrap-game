# 로컬 실행 스크립트 (개발용). D:\Compassion\.tools 의 휴대용 JDK/Maven 이 있으면 사용한다.
param([int]$Port = 8080)
$tools = Join-Path $PSScriptRoot "..\.tools"
$jdk = Get-ChildItem $tools -Directory -Filter "jdk-21*" -ErrorAction SilentlyContinue | Select-Object -First 1
$mvn = Get-ChildItem $tools -Directory -Filter "apache-maven-*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jdk) { $env:JAVA_HOME = $jdk.FullName; $env:PATH = "$($jdk.FullName)\bin;$env:PATH" }
if ($mvn) { $env:PATH = "$($mvn.FullName)\bin;$env:PATH" }
$env:PORT = "$Port"
Set-Location $PSScriptRoot
mvn -q -B spring-boot:run
