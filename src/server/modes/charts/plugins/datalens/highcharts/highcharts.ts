import set from 'lodash/set';

import type {
    DATASET_FIELD_TYPES,
    FeatureConfig,
    ServerChartsConfig,
    ServerPlaceholder,
} from '../../../../../../shared';
import {
    AxisLabelFormatMode,
    ChartkitHandlers,
    LabelsPositions,
    LegendDisplayMode,
    VISUALIZATIONS_WITH_LABELS_POSITION,
    WizardVisualizationId,
    isDateField,
} from '../../../../../../shared';
import {PERCENT_VISUALIZATIONS} from '../../../../../../shared/constants/visualization';
import type {IgnoreProps} from '../utils/axis-helpers';
import {applyPlaceholderSettingsToAxis} from '../utils/axis-helpers';
import {mapChartsConfigToServerConfig} from '../utils/config-helpers';
import {isNumericalDataType, log} from '../utils/misc-helpers';

type ExtendedHighchartsLegendOptions = Omit<Highcharts.LegendOptions, 'labelFormatter'> & {
    labelFormatter?:
        | typeof ChartkitHandlers.WizardLabelFormatter
        | Highcharts.LegendOptions['labelFormatter'];
};

type ExtendedHighchartsOptions = Omit<Highcharts.Options, 'legend'> & {
    legend?: ExtendedHighchartsLegendOptions;
};

// eslint-disable-next-line complexity
export const buildHighchartsConfigPrivate = (args: {
    shared: ServerChartsConfig;
    features: FeatureConfig;
}) => {
    const shared = mapChartsConfigToServerConfig(args.shared);

    if (
        ['geolayer', 'geopoint', 'geopolygon', 'heatmap', 'polyline'].includes(
            shared.visualization.id,
        )
    ) {
        // center and zoom are specified as the default value if bounds does not arrive
        // if bounds comes, then center and zoom are ignored
        return {
            state: {
                center: [55.76, 37.64],
                zoom: 8,
                controls: ['zoomControl'],
                behaviors: ['drag', 'scrollZoom', 'multiTouch'],
            },
            options: {},
        };
    }

    const tooltip: Highcharts.Options['tooltip'] = {};
    let legend: ExtendedHighchartsLegendOptions = {};
    let colorAxis: Highcharts.Options['colorAxis'];

    let xAxis: Highcharts.Options['xAxis'] = {
        endOnTick: false,
    };

    let yAxis: Highcharts.Options['yAxis'] = {};

    const chart: Highcharts.ChartOptions = {
        type: shared.visualization.highchartsId || shared.visualization.id,
        zoomType: 'x',
    };

    if (shared.visualization.id === WizardVisualizationId.CombinedChart) {
        chart.type = '';
    }

    const plotOptions: any = {};

    const axisWithAppliedSettings = applyCommonAxisSettings({shared, xAxis, yAxis});
    xAxis = axisWithAppliedSettings.xAxis;
    yAxis = axisWithAppliedSettings.yAxis;

    // We apply settings that are unique for each type of visualization

    const visualizationsIds = [shared.visualization.id].concat(
        (shared.visualization.layers || []).map((layer) => layer.id),
    );

    visualizationsIds.forEach((visualizationId) => {
        switch (visualizationId) {
            case WizardVisualizationId.Line: {
                chart.zoomType = 'xy';
                legend.symbolWidth = 38;
                break;
            }
            case WizardVisualizationId.Column:
            case WizardVisualizationId.Column100p:
            case WizardVisualizationId.Bar:
            case WizardVisualizationId.Bar100p:
            case WizardVisualizationId.CombinedChart: {
                chart.zoomType = 'xy';

                legend.labelFormatter = ChartkitHandlers.WizardLabelFormatter;
                break;
            }
            case WizardVisualizationId.Pie3D: {
                chart.options3d = {
                    enabled: true,
                    alpha: 35,
                    beta: 2,
                };
            }
        }

        extendPlotOptions({visualizationId: shared.visualization.id, plotOptions});

        shared.visualization.layers?.forEach((layer) => {
            extendPlotOptions({visualizationId: layer.id, plotOptions});
        });
    });

    if (shared.visualization.id === WizardVisualizationId.Area) {
        plotOptions.area = {
            stacking: shared.extraSettings?.stacking !== 'off' ? 'normal' : undefined,
        };
    }

    if (shared.visualization.id === WizardVisualizationId.Scatter) {
        plotOptions.series = {turboThreshold: 100000};
        plotOptions.scatter = {
            tooltip: {
                formatter: ChartkitHandlers.WizardScatterTooltipFormatter,
            },
        };

        chart.zoomType = 'xy';

        const xPlaceholder = shared.visualization.placeholders.find(
            (placeholder) => placeholder.id === 'x',
        );
        if (xPlaceholder && xPlaceholder.items.length) {
            const xItem = xPlaceholder.items[0];

            if (isDateField(xItem)) {
                (xAxis as Highcharts.XAxisOptions).type = 'datetime';
            }
        }

        if (!Array.isArray(yAxis)) {
            yAxis.labels = {...(yAxis.labels || {})};

            const yPlaceholder = shared.visualization.placeholders.find(
                (placeholder) => placeholder.id === 'y',
            );
            if (yPlaceholder && yPlaceholder.items.length) {
                const yItem = yPlaceholder.items[0];

                if (isDateField(yItem)) {
                    yAxis.type = 'datetime';
                }

                if (
                    !isNumericalDataType(yItem.data_type as DATASET_FIELD_TYPES) &&
                    !isDateField(yItem) &&
                    yPlaceholder.settings?.axisFormatMode !== AxisLabelFormatMode.ByField
                ) {
                    // A special formatter that returns text labels on the Y axis
                    // @ts-ignore
                    yAxis.labels.formatter = ChartkitHandlers.WizardScatterYAxisLabelFormatter;
                }
            }
        }
    }

    if (shared.visualization.id === WizardVisualizationId.Treemap) {
        chart.zoomType = undefined;
        plotOptions.treemap = {
            tooltip: {
                pointFormatter: ChartkitHandlers.WizardTreemapTooltipFormatter,
            },
        };
    }

    if (shared.extraSettings?.legendMode === LegendDisplayMode.Hide) {
        legend = {
            enabled: false,
        };
    }

    if (shared.extraSettings?.tooltip === 'hide') {
        tooltip.enabled = false;
    }

    if (
        shared.extraSettings?.labelsPosition &&
        visualizationsIds.some((id) => VISUALIZATIONS_WITH_LABELS_POSITION.has(id))
    ) {
        plotOptions.series = {
            ...plotOptions.series,
            dataLabels: {
                ...plotOptions.series?.dataLabels,
                inside: shared.extraSettings?.labelsPosition !== LabelsPositions.Outside,
            },
        };
    }

    const allowOverlap = shared.extraSettings?.overlap === 'on';

    plotOptions.series = {
        ...plotOptions.series,
        dataGrouping: {
            ...plotOptions.series?.dataGrouping,
            enabled: false,
        },
        dataLabels: {
            ...plotOptions.series?.dataLabels,
            allowOverlap,
        },
    };

    const navigator: Highcharts.Options['navigator'] = {
        series: {
            dataLabels: {color: 'transparent'},
            fillOpacity: 0.15,
        },
    };

    switch (shared.visualization.id) {
        case WizardVisualizationId.Column: {
            set(navigator, 'yAxis.softMin', 0);
            break;
        }
    }

    const result: ExtendedHighchartsOptions = {
        chart,
        legend,
        xAxis,
        yAxis,
        tooltip,
        colorAxis,
        plotOptions,
        // https://api.highcharts.com/highstock/navigator.series
        // Option navigator.series.dataLabels.enabled = false does not work (highcharts v8.2.2)
        // The documentation says that the series between the chart and the navigator are fumbling, and apparently,
        // because of this, there is a problem when trying to hide dataLabels, because they are marked in the series
        navigator,
    };

    log('HIGHCHARTS:');
    log(result);

    return result;
};

type ApplyCommonAxisSettingsPayload = {
    xAxis: NonNullable<Highcharts.Options['xAxis']>;
    yAxis: NonNullable<Highcharts.Options['yAxis']>;
    shared: ServerChartsConfig;
};

const applyCommonAxisSettings = ({
    shared,
    xAxis,
    yAxis,
}: ApplyCommonAxisSettingsPayload): {
    xAxis: NonNullable<Highcharts.Options['xAxis']>;
    yAxis: NonNullable<Highcharts.Options['yAxis']>;
} => {
    const visualization = shared.visualization;

    const ignore: IgnoreProps = {
        title: Boolean((shared.segments || []).length),
    };

    // Apply common settings for axes
    if (
        visualization.id === WizardVisualizationId.Line ||
        visualization.id === WizardVisualizationId.Area ||
        visualization.id === WizardVisualizationId.Area100p ||
        visualization.id === WizardVisualizationId.Column ||
        visualization.id === WizardVisualizationId.Column100p ||
        visualization.id === WizardVisualizationId.Bar ||
        visualization.id === WizardVisualizationId.Bar100p ||
        visualization.id === WizardVisualizationId.Scatter ||
        visualization.id === WizardVisualizationId.CombinedChart
    ) {
        let x: ServerPlaceholder | undefined;
        let y: ServerPlaceholder | undefined;
        let y2: ServerPlaceholder | undefined;

        if (visualization.id === WizardVisualizationId.CombinedChart) {
            visualization.layers?.forEach((layer) => {
                const placeholders = layer.placeholders;

                x = x?.items.length ? x : placeholders[0];
                y = y?.items.length ? y : placeholders[1];
                y2 = y2?.items.length ? y2 : placeholders[2];
            });
        } else {
            const placeholders = visualization.placeholders;

            x = placeholders[0];
            y = placeholders[1];
            y2 = placeholders[2];
        }

        let axes: (Highcharts.XAxisOptions | Highcharts.YAxisOptions)[] = [
            xAxis as Highcharts.XAxisOptions,
        ];
        let axesData = [x];

        if (y?.items.length && y2?.items.length) {
            yAxis = [
                {
                    opposite: false,
                    labels: {
                        y: 3,
                    },
                },
                {
                    opposite: true,
                    labels: {
                        y: 3,
                    },
                },
            ];

            axes = [...axes, yAxis[0], yAxis[1]];
            axesData = [...axesData, y, y2];
        } else {
            (yAxis as Highcharts.XAxisOptions).opposite = Boolean(
                !y?.items.length && y2?.items.length,
            );
            (yAxis as Highcharts.XAxisOptions).labels = {
                y: 3,
            };

            axes = [...axes, yAxis as Highcharts.XAxisOptions];
            const isY2HasItems = y2 && y2.items.length;
            axesData = [...axesData, isY2HasItems ? y2 : y];
        }

        // eslint-disable-next-line complexity
        axes.forEach((axis, i) => {
            const axisData = axesData[i];

            applyPlaceholderSettingsToAxis(axisData, axis, ignore);
        });
    }

    // Due to fractional values (presumably) highcharts sometimes incorrectly calculates the maximum
    // in this case, the chart is displayed correctly, but the maximum value on the y axis becomes more than 100 percent
    if (PERCENT_VISUALIZATIONS.has(visualization.id) && !('max' in yAxis)) {
        set(yAxis, 'max', 100);
    }

    return {xAxis, yAxis};
};

type ExtendPlotOptionsPayload = {
    visualizationId: string;
    plotOptions: NonNullable<Highcharts.PlotOptions>;
};

const extendPlotOptions = ({visualizationId, plotOptions}: ExtendPlotOptionsPayload) => {
    switch (visualizationId) {
        case WizardVisualizationId.Column:
            plotOptions.column = plotOptions.column || {};
            plotOptions.column.stacking = 'normal';
            break;

        case WizardVisualizationId.Bar:
            plotOptions.bar = plotOptions.bar || {};
            plotOptions.bar.stacking = 'normal';
            break;

        case WizardVisualizationId.Column100p:
            plotOptions.column = plotOptions.column || {};
            plotOptions.column.stacking = 'percent';
            break;

        case 'area':
            plotOptions.area = {
                stacking: 'normal',
            };
            break;

        case WizardVisualizationId.Bar100p:
            plotOptions.bar = plotOptions.bar || {};
            plotOptions.bar.stacking = 'percent';
            break;

        case WizardVisualizationId.Area100p:
            plotOptions.area = {
                stacking: 'percent',
            };
            break;
        case WizardVisualizationId.Pie:
            plotOptions.pie = {
                allowPointSelect: false,
            };
            break;
        case WizardVisualizationId.Pie3D:
            plotOptions.pie = {
                allowPointSelect: false,
                depth: 55,
            };
            break;
        case WizardVisualizationId.Donut:
            plotOptions.pie = {
                allowPointSelect: false,
                innerSize: '50%',
            };
            break;
    }

    switch (visualizationId) {
        case WizardVisualizationId.Column:
        case WizardVisualizationId.Column100p:
        case WizardVisualizationId.Bar:
        case WizardVisualizationId.Bar100p: {
            plotOptions.column = plotOptions.column || {};
            plotOptions.column.dataGrouping = plotOptions.column.dataGrouping || {};
            // CHARTS-6460
            plotOptions.column.dataGrouping.enabled = false;
            plotOptions.column.maxPointWidth = 50;

            plotOptions.bar = plotOptions.bar || {};
            break;
        }
    }
};
