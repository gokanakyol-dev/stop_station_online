import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { getAnalytics, getSystemHealth } from '../services/api';

const { width } = Dimensions.get('window');

export default function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [analyticsData, healthData] = await Promise.all([
        getAnalytics(),
        getSystemHealth()
      ]);
      setAnalytics(analyticsData);
      setSystemHealth(healthData);
    } catch (error) {
      console.error('Stats load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>İstatistikler yükleniyor...</Text>
      </View>
    );
  }

  const stats = analytics?.stats || {};
  const topRoutes = analytics?.topRoutes || [];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#10B981"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>📊 İSTATİSTİKLER</Text>
        <Text style={styles.subtitle}>Sistem Analitikleri</Text>
      </View>

      {/* System Health Badge */}
      {systemHealth && (
        <View style={[
          styles.healthBadge,
          systemHealth.status === 'online' ? styles.healthOnline : styles.healthOffline
        ]}>
          <Text style={styles.healthText}>
            {systemHealth.status === 'online' ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>
      )}

      {/* Main Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          title="Toplam Durak"
          value={stats.totalStops?.toLocaleString('tr-TR') || '0'}
          icon="📍"
          color="#3B82F6"
        />
        <StatCard
          title="Onaylı Durak"
          value={stats.approvedStops?.toLocaleString('tr-TR') || '0'}
          icon="✅"
          color="#10B981"
        />
        <StatCard
          title="Reddedilen"
          value={stats.rejectedStops?.toLocaleString('tr-TR') || '0'}
          icon="❌"
          color="#EF4444"
        />
        <StatCard
          title="Eklenen Durak"
          value={stats.addedStops?.toLocaleString('tr-TR') || '0'}
          icon="➕"
          color="#F59E0B"
        />
      </View>

      {/* Detailed Stats */}
      <View style={styles.detailedSection}>
        <Text style={styles.sectionTitle}>DETAYLAR</Text>
        
        <DetailRow
          label="Toplam GPS Noktası"
          value={stats.totalGpsPoints?.toLocaleString('tr-TR') || '0'}
        />
        <DetailRow
          label="Toplam Hat Sayısı"
          value={stats.totalRoutes?.toLocaleString('tr-TR') || '0'}
        />
        <DetailRow
          label="Saha Aksiyonları"
          value={stats.totalFieldActions?.toLocaleString('tr-TR') || '0'}
        />
        <DetailRow
          label="Onay Oranı"
          value={calculateApprovalRate(stats)}
        />
      </View>

      {/* Top Routes */}
      {topRoutes.length > 0 && (
        <View style={styles.topRoutesSection}>
          <Text style={styles.sectionTitle}>EN FAZLA AKSİYON ALAN HATLAR</Text>
          {topRoutes.slice(0, 5).map((route, index) => (
            <RouteRow
              key={route.route_id}
              rank={index + 1}
              routeNumber={route.route_number}
              routeName={route.route_name}
              actionCount={route.action_count}
            />
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}
        </Text>
      </View>
    </ScrollView>
  );
}

// Stat Card Component
const StatCard = ({ title, value, icon, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

// Detail Row Component
const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

// Route Row Component
const RouteRow = ({ rank, routeNumber, routeName, actionCount }) => (
  <View style={styles.routeRow}>
    <View style={styles.routeRank}>
      <Text style={styles.routeRankText}>#{rank}</Text>
    </View>
    <View style={styles.routeInfo}>
      <Text style={styles.routeNumber}>{routeNumber}</Text>
      <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
    </View>
    <View style={styles.routeCount}>
      <Text style={styles.routeCountText}>{actionCount}</Text>
      <Text style={styles.routeCountLabel}>aksiyon</Text>
    </View>
  </View>
);

// Helper Functions
const calculateApprovalRate = (stats) => {
  const total = (stats.approvedStops || 0) + (stats.rejectedStops || 0);
  if (total === 0) return '0%';
  const rate = ((stats.approvedStops || 0) / total * 100).toFixed(1);
  return `${rate}%`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9CA3AF'
  },
  header: {
    backgroundColor: '#1F2937',
    padding: 20,
    paddingTop: 140,
    paddingBottom: 24
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '400'
  },
  healthBadge: {
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  healthOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10B981'
  },
  healthOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444'
  },
  healthText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12
  },
  statCard: {
    width: (width - 44) / 2,
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    alignItems: 'center'
  },
  statIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4
  },
  statTitle: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
    textAlign: 'center'
  },
  detailedSection: {
    margin: 16,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 16,
    letterSpacing: 0.5
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 85, 99, 0.3)'
  },
  detailLabel: {
    fontSize: 15,
    color: '#D1D5DB',
    fontWeight: '500'
  },
  detailValue: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  topRoutesSection: {
    margin: 16,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 85, 99, 0.3)'
  },
  routeRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  routeRankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981'
  },
  routeInfo: {
    flex: 1
  },
  routeNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2
  },
  routeName: {
    fontSize: 13,
    color: '#9CA3AF'
  },
  routeCount: {
    alignItems: 'flex-end'
  },
  routeCountText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#10B981'
  },
  routeCountLabel: {
    fontSize: 11,
    color: '#6B7280'
  },
  footer: {
    padding: 20,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 13,
    color: '#6B7280'
  }
});
