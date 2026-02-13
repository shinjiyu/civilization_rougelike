#!/bin/bash
P='GET /c6/(index\.html)? HTTP'
echo "=== 今日 /c6/ 页面访问 ==="
pv=$(grep -cE "$P" /var/log/nginx/access.log)
uv=$(grep -E "$P" /var/log/nginx/access.log | awk '{print $1}' | sort -u | wc -l)
echo "PV: $pv   UV: $uv"
echo
echo "=== 按小时分布 ==="
grep -E "$P" /var/log/nginx/access.log | awk -F'[' '{print $2}' | cut -d: -f2 | sort | uniq -c | sort -k2
echo
echo "=== 访客详情 ==="
grep -E "$P" /var/log/nginx/access.log | awk -F'"' '{ip=$0; sub(/ -.*/,"",ip); ua=$6; sub(/Mozilla\/5.0 \(/,"",ua); sub(/\) .*/,"",ua); printf "%-18s %s\n", ip, ua}'
