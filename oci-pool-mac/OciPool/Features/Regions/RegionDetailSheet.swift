import SwiftUI

/// 区域详情抽屉（对齐 Web `useRegionDetailDrawer` · 宽 680 · globe/info · statusDot）。
struct RegionDetailSheet: View {
    let row: RegionRow
    @ObservedObject var model: RegionsViewModel
    var dark: Bool
    var onClose: () -> Void

    private var accent: Color { AppTheme.sidebarActive }
    private var info: Color { AppTheme.info }
    private var cyan: Color { Color(hex: "00b6be") }
    private var fg0: Color { dark ? Color(hex: "f6f9fb") : Color(hex: "0c1217") }
    private var fg1: Color { dark ? Color(hex: "ccd2d6") : Color(hex: "2d3439") }
    private var fg3: Color { dark ? Color(hex: "5d646a") : Color(hex: "81878c") }
    private var bg2: Color { dark ? Color(hex: "151c21") : Color(hex: "f1f4f6") }
    private var bg3: Color { dark ? Color(hex: "1e252a") : Color(hex: "e7ecef") }
    private var borderColor: Color { dark ? Color(hex: "363e45") : Color(hex: "bfc5ca") }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().overlay(AppTheme.border(dark))
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    sectionLabel("放货概览")
                    overviewGrid

                    sectionLabel("近 30 天放货趋势")
                    Text("后端当前未提供历史趋势接口")
                        .font(.system(size: 12))
                        .foregroundColor(fg3)
                        .frame(maxWidth: .infinity)
                        .padding(20)
                        .background(RoundedRectangle(cornerRadius: 8).fill(bg2))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))

                    sectionLabel("关联租户 (\(model.relatedTenants.count))")
                    if model.regionDetailLoading && model.relatedTenants.isEmpty {
                        HStack { Spacer(); ProgressView(); Spacer() }.padding(20)
                    } else if model.relatedTenants.isEmpty {
                        Text("暂无租户以此为主区域")
                            .font(.system(size: 12))
                            .foregroundColor(fg3)
                            .frame(maxWidth: .infinity)
                            .padding(20)
                    } else {
                        VStack(spacing: 4) {
                            ForEach(model.relatedTenants) { t in
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(t.isActive ? accent : fg3)
                                        .frame(width: 5, height: 5)
                                    Text(t.chipName)
                                        .font(.system(size: 10.5, design: .monospaced))
                                        .foregroundColor(fg1)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(RoundedRectangle(cornerRadius: 3).fill(bg3))
                                    Text(t.displayName)
                                        .font(.system(size: 12))
                                        .foregroundColor(fg0)
                                        .lineLimit(1)
                                    Spacer(minLength: 0)
                                    Text("\(t.activeDays)天")
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(fg3)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(RoundedRectangle(cornerRadius: 6).fill(bg2))
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppTheme.border(dark), lineWidth: 1))
                            }
                        }
                    }

                    sectionLabel("从此区域抢到的实例 (\(model.relatedInstances.count))")
                    if model.relatedInstances.isEmpty {
                        Text(model.regionDetailLoading ? "加载中..." : "暂无实例")
                            .font(.system(size: 12))
                            .foregroundColor(fg3)
                            .frame(maxWidth: .infinity)
                            .padding(20)
                    } else {
                        VStack(spacing: 4) {
                            ForEach(model.relatedInstances) { i in
                                HStack(spacing: 8) {
                                    Circle()
                                        .fill(i.state.lowercased() == "running" ? accent : fg3)
                                        .frame(width: 5, height: 5)
                                    Text(i.name)
                                        .font(.system(size: 12))
                                        .foregroundColor(fg0)
                                        .lineLimit(1)
                                    Spacer(minLength: 0)
                                    Text("\(i.cpu)C\(i.mem)G")
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(fg3)
                                    Text(i.ip.isEmpty ? "—" : i.ip)
                                        .font(.system(size: 11, design: .monospaced))
                                        .foregroundColor(cyan)
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(RoundedRectangle(cornerRadius: 6).fill(bg2))
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(AppTheme.border(dark), lineWidth: 1))
                            }
                        }
                    }
                }
                .padding(20)
            }

            Divider().overlay(AppTheme.border(dark))
            HStack(spacing: 8) {
                AppButton(title: "在此区域抢机", systemImage: "zap.fill", kind: .primary, action: onClose)
                AppButton(title: "订阅放货通知", systemImage: "bell", kind: .secondary, action: onClose)
                Spacer()
                AppButton(title: "关闭", systemImage: "xmark", kind: .secondary, action: onClose)
            }
            .padding(16)
        }
        .frame(width: 560)
        .background(AppTheme.pageBg(dark))
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(info.opacity(0.12))
                    .frame(width: 38, height: 38)
                Image(systemName: "globe")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(info)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(row.name)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(fg0)
                        .lineLimit(1)
                    // Web statusDot：released=active 脉冲，否则 idle
                    Circle()
                        .fill(row.isOpen ? accent : fg3)
                        .frame(width: 6, height: 6)
                }
                Text(row.regionCode)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(fg3)
            }
            Spacer(minLength: 8)
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(fg1)
                    .frame(width: 26, height: 26)
                    .background(RoundedRectangle(cornerRadius: 5).fill(bg2))
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(16)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10.5, weight: .semibold))
            .tracking(0.5)
            .foregroundColor(fg3)
            .textCase(.uppercase)
    }

    private var overviewGrid: some View {
        HStack(spacing: 10) {
            metricBox(label: "总开机数", value: "\(row.openCount)",
                      color: row.openCount > 100 ? accent : fg1)
            metricBox(label: "今日开机", value: "\(row.todayGrabs)",
                      color: row.todayGrabs > 0 ? AppTheme.orange : fg3)
            metricBox(label: "关联租户", value: "\(model.relatedTenants.count)", color: cyan)
        }
    }

    private func metricBox(label: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 10.5, weight: .medium))
                .tracking(0.5)
                .textCase(.uppercase)
                .foregroundColor(fg3)
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .monospaced))
                .foregroundColor(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 8).fill(bg2))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(AppTheme.border(dark), lineWidth: 1))
    }
}
